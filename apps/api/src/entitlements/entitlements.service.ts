import { Injectable } from '@nestjs/common';
import { buildFeatureMap, EntitlementSnapshot } from '@charuto/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService, CacheTTL } from '../redis/cache.service';

export interface TrialRecap {
  reviewsCount: number;
  countriesCount: number;
  achievementsUnlockedCount: number;
  daysLeft: number;
}

function entitlementsCacheKey(userId: string): string {
  return `entitlements:${userId}`;
}

/**
 * Fonte única de verdade sobre acesso Premium (seção 6.4): o cliente NUNCA
 * decide se um recurso é liberado, apenas reflete o que este serviço
 * resolveu. `resolveForUser` é chamado por qualquer módulo que precise saber
 * se o usuário tem acesso (humidor, guard de feature, etc.), com cache em
 * duas camadas: tabela `entitlements` (persistente, auditável) + Redis
 * (`entitlements:${userId}`, TTL curto). O cache Redis é invalidado
 * explicitamente sempre que uma assinatura muda de status (webhook do
 * Stripe) ou o trial expira (cron) — nunca por polling.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async resolveForUser(userId: string): Promise<EntitlementSnapshot> {
    const cacheKey = entitlementsCacheKey(userId);
    const cached = await this.cache.get<EntitlementSnapshot>(cacheKey);
    if (cached) return cached;

    const snapshot = await this.recompute(userId);
    await this.cache.set(cacheKey, snapshot, CacheTTL.ENTITLEMENTS);
    return snapshot;
  }

  /** Invalidação explícita (seção 6.4): chamada pelo webhook do Stripe e pelo cron de trial. */
  async invalidate(userId: string): Promise<void> {
    await this.cache.del(entitlementsCacheKey(userId));
  }

  private async recompute(userId: string): Promise<EntitlementSnapshot> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const now = new Date();

    const isTrialActive =
      user.subscriptionStatus === 'TRIALING' && user.trialEndsAt !== null && user.trialEndsAt > now;

    let isPremium = isTrialActive;
    let premiumUntil: Date | null = isTrialActive ? user.trialEndsAt : null;

    if (!isPremium) {
      const activeSubscription = await this.prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          plan: { in: ['PREMIUM_MONTHLY', 'PREMIUM_YEARLY'] },
        },
        orderBy: { currentPeriodEnd: 'desc' },
      });
      if (activeSubscription) {
        isPremium = true;
        premiumUntil = activeSubscription.currentPeriodEnd;
      }
    }

    const snapshot: EntitlementSnapshot = {
      isPremium,
      isTrial: isTrialActive,
      trialEndsAt: user.trialEndsAt ? user.trialEndsAt.toISOString() : null,
      premiumUntil: premiumUntil ? premiumUntil.toISOString() : null,
      features: buildFeatureMap(isPremium),
      resolvedAt: now.toISOString(),
    };

    await this.prisma.entitlement.upsert({
      where: { userId },
      create: {
        userId,
        isPremium: snapshot.isPremium,
        isTrial: snapshot.isTrial,
        trialEndsAt: user.trialEndsAt,
        premiumUntil,
        resolvedAt: now,
      },
      update: {
        isPremium: snapshot.isPremium,
        isTrial: snapshot.isTrial,
        trialEndsAt: user.trialEndsAt,
        premiumUntil,
        resolvedAt: now,
      },
    });

    return snapshot;
  }

  /**
   * "No dia 4, mostre uma tela contando o que a pessoa já fez" (seção 6.3).
   * Tudo calculado de verdade a partir do banco, contado desde o início do
   * trial (ou desde o cadastro, se por algum motivo o trial nunca foi
   * concedido — ex.: mesmo installationId já usado antes).
   */
  async getTrialRecap(userId: string): Promise<TrialRecap> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const since = user.trialStartedAt ?? user.createdAt;
    const now = new Date();

    const daysLeft = user.trialEndsAt
      ? Math.max(0, Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
      : 0;

    const [reviewsCount, countriesRows, achievementsUnlockedCount] = await Promise.all([
      this.prisma.review.count({ where: { userId, deletedAt: null, createdAt: { gte: since } } }),
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(DISTINCT c.country_code)::bigint AS count
        FROM reviews r
        JOIN cigars c ON c.id = r.cigar_id
        WHERE r.user_id = ${userId}::uuid
          AND r.deleted_at IS NULL
          AND r.created_at >= ${since}
      `,
      this.prisma.userAchievement.count({ where: { userId, unlockedAt: { gte: since } } }),
    ]);

    return {
      reviewsCount,
      countriesCount: Number(countriesRows[0]?.count ?? 0),
      achievementsUnlockedCount,
      daysLeft,
    };
  }
}
