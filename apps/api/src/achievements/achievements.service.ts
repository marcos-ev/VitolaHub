import { Injectable, Logger } from '@nestjs/common';
import { Achievement } from '@prisma/client';
import { AchievementProgress } from '@charuto/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DomainEvent, DomainEventPayload } from '../queue/queue.constants';
import { AchievementRule, parseAchievementRule, startOfIsoWeekUtc } from './achievement-rules';

/**
 * Motor de conquistas (seção 5.4). Orientado a eventos, mas nunca confia no
 * payload do evento para decidir se um selo foi conquistado: sempre
 * recalcula o estado atual do usuário com uma query real contra o banco.
 * Isso torna o motor imune tanto a jobs duplicados quanto a payloads
 * desatualizados (ex.: dois jobs processados fora de ordem).
 *
 * Idempotência (critério de aceite crítico — "um selo é desbloqueado
 * exatamente uma vez, mesmo com evento duplicado na fila"): a escrita em
 * `UserAchievement` usa `createMany` com `skipDuplicates: true` sobre a
 * chave primária composta `(userId, achievementId)`. Preferimos isso a
 * `upsert` porque `upsert()` não informa se o caminho foi create ou update —
 * já `createMany` devolve `{ count }`, e é exatamente essa contagem (0 ou 1)
 * que usamos para decidir se a notificação de "selo desbloqueado" deve ser
 * disparada. A garantia de unicidade em si vem do MESMO índice único
 * `userId_achievementId` do schema, não de uma checagem "if not exists" em
 * memória — a aplicação nunca decide sozinha que uma linha não existe.
 */
@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async evaluateEvent<E extends DomainEvent>(event: E, payload: DomainEventPayload[E]): Promise<void> {
    const userId = (payload as { userId?: string }).userId;
    if (!userId) return;

    // "10/50/100 amigos": conta apenas eventos que de fato geraram amizade
    // (o mesmo evento FOLLOW_ACCEPTED também é publicado para follows
    // assimétricos que não amadureceram em amizade recíproca).
    if (event === DomainEvent.FOLLOW_ACCEPTED) {
      const becameFriends = (payload as DomainEventPayload[DomainEvent.FOLLOW_ACCEPTED]).becameFriends;
      if (becameFriends !== true) return;
    }

    const achievements = await this.prisma.achievement.findMany({
      where: { rule: { path: ['event'], equals: event } },
    });

    for (const achievement of achievements) {
      try {
        await this.evaluateAchievementForUser(achievement, userId);
      } catch (error) {
        this.logger.error(
          `Falha ao avaliar conquista ${achievement.code} para usuário ${userId}: ${(error as Error).message}`,
        );
      }
    }
  }

  /** Avalia uma conquista específica para um usuário. Retorna `true` se acabou de ser desbloqueada agora. */
  async evaluateAchievementForUser(achievement: Achievement, userId: string): Promise<boolean> {
    const rule = parseAchievementRule(achievement.rule);
    const currentValue = await this.computeCurrentValue(rule, userId);
    if (currentValue < rule.target) return false;

    const { count } = await this.prisma.userAchievement.createMany({
      data: [{ userId, achievementId: achievement.id }],
      skipDuplicates: true,
    });
    const newlyUnlocked = count === 1;

    if (newlyUnlocked) {
      await this.notifications.create({
        userId,
        type: 'ACHIEVEMENT_UNLOCKED',
        entityType: 'Achievement',
        entityId: achievement.id,
      });
    }

    return newlyUnlocked;
  }

  /** `GET /achievements/me`: desbloqueado ou não, com progresso real 0..1. */
  async getProgressForUser(userId: string): Promise<AchievementProgress[]> {
    const [achievements, unlockedRows] = await Promise.all([
      this.prisma.achievement.findMany({ orderBy: [{ tier: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.userAchievement.findMany({ where: { userId } }),
    ]);

    const unlockedAtByAchievementId = new Map(unlockedRows.map((row) => [row.achievementId, row.unlockedAt]));

    const progress: AchievementProgress[] = [];
    for (const achievement of achievements) {
      const unlockedAt = unlockedAtByAchievementId.get(achievement.id) ?? null;
      const rule = parseAchievementRule(achievement.rule);
      const currentValue = unlockedAt ? rule.target : await this.computeCurrentValue(rule, userId);
      const ratio = rule.target > 0 ? Math.min(1, currentValue / rule.target) : unlockedAt ? 1 : 0;

      progress.push({
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        tier: achievement.tier,
        unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
        progress: unlockedAt ? 1 : ratio,
        current: Math.min(currentValue, rule.target),
        target: rule.target,
      });
    }

    return progress;
  }

  private async computeCurrentValue(rule: AchievementRule, userId: string): Promise<number> {
    switch (rule.type) {
      case 'count':
        return this.computeCountValue(rule.event, userId);
      case 'distinct_count':
        return this.computeDistinctCountValue(rule.event, rule.field, userId);
      case 'streak_weeks':
        return this.computeStreakWeeksValue(userId);
      default:
        return 0;
    }
  }

  private async computeCountValue(event: DomainEvent, userId: string): Promise<number> {
    switch (event) {
      case DomainEvent.REVIEW_CREATED:
        return this.prisma.review.count({ where: { userId, deletedAt: null } });
      case DomainEvent.HUMIDOR_ITEM_ADDED:
        return this.prisma.humidorItem.count({ where: { userId, deletedAt: null } });
      case DomainEvent.CIGAR_SUGGESTION_APPROVED:
        return this.prisma.cigar.count({ where: { suggestedBy: userId, status: 'APPROVED', deletedAt: null } });
      case DomainEvent.FOLLOW_ACCEPTED: {
        // `friendCount` é o contador desnormalizado mantido pelo CountersService
        // a partir da reciprocidade real de `follows` — consultar aqui é
        // consultar o estado atual do usuário, não confiar em payload.
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { friendCount: true } });
        return user?.friendCount ?? 0;
      }
      default:
        return 0;
    }
  }

  private async computeDistinctCountValue(
    event: DomainEvent,
    field: 'cigar.country_code' | 'cigar.vitola',
    userId: string,
  ): Promise<number> {
    if (event !== DomainEvent.REVIEW_CREATED) return 0;

    if (field === 'cigar.country_code') {
      const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(DISTINCT c.country_code)::bigint AS count
        FROM reviews r
        JOIN cigars c ON c.id = r.cigar_id
        WHERE r.user_id = ${userId}::uuid AND r.deleted_at IS NULL
      `;
      return Number(rows[0]?.count ?? 0);
    }

    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(DISTINCT c.vitola)::bigint AS count
      FROM reviews r
      JOIN cigars c ON c.id = r.cigar_id
      WHERE r.user_id = ${userId}::uuid AND r.deleted_at IS NULL AND c.vitola IS NOT NULL
    `;
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * "4 semanas seguidas com registro": conta semanas ISO consecutivas com
   * pelo menos uma review, andando para trás a partir da semana atual. Um
   * gap (semana sem review) interrompe a sequência.
   */
  private async computeStreakWeeksValue(userId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ week_start: Date }[]>`
      SELECT DISTINCT date_trunc('week', review_date)::date AS week_start
      FROM reviews
      WHERE user_id = ${userId}::uuid AND deleted_at IS NULL
    `;
    if (rows.length === 0) return 0;

    const weekStartTimestamps = new Set(rows.map((row) => new Date(row.week_start).getTime()));
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    let streak = 0;
    let cursor = startOfIsoWeekUtc(new Date()).getTime();
    while (weekStartTimestamps.has(cursor)) {
      streak += 1;
      cursor -= oneWeekMs;
    }
    return streak;
  }
}
