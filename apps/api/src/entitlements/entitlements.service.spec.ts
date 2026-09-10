import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { EntitlementsService } from './entitlements.service';

describe('EntitlementsService', () => {
  let service: EntitlementsService;
  let prisma: {
    user: { findUniqueOrThrow: jest.Mock };
    subscription: { findFirst: jest.Mock };
    entitlement: { upsert: jest.Mock };
  };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUniqueOrThrow: jest.fn() },
      subscription: { findFirst: jest.fn() },
      entitlement: { upsert: jest.fn() },
    };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EntitlementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = moduleRef.get(EntitlementsService);
    cache.get.mockResolvedValue(null); // força recomputo no service em todos os testes
    prisma.entitlement.upsert.mockResolvedValue({});
  });

  it('trial ativo concede acesso Premium completo (isPremium true, isTrial true)', async () => {
    const future = new Date(Date.now() + 3 * 86_400_000);
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      subscriptionStatus: 'TRIALING',
      trialEndsAt: future,
    });

    const snapshot = await service.resolveForUser('user-1');

    expect(snapshot.isPremium).toBe(true);
    expect(snapshot.isTrial).toBe(true);
    expect(snapshot.premiumUntil).toBe(future.toISOString());
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith('entitlements:user-1', expect.objectContaining({ isPremium: true }), expect.any(Number));
  });

  it('trial expirado sem subscription resulta em isPremium false', async () => {
    const past = new Date(Date.now() - 86_400_000);
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      subscriptionStatus: 'TRIALING', // ainda não passou pelo cron de expiração
      trialEndsAt: past,
    });
    prisma.subscription.findFirst.mockResolvedValue(null);

    const snapshot = await service.resolveForUser('user-1');

    expect(snapshot.isPremium).toBe(false);
    expect(snapshot.isTrial).toBe(false);
    expect(snapshot.premiumUntil).toBeNull();
  });

  it('subscription ACTIVE com plano Premium resulta em isPremium true, isTrial false', async () => {
    const periodEnd = new Date(Date.now() + 30 * 86_400_000);
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    });
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      plan: 'PREMIUM_MONTHLY',
      currentPeriodEnd: periodEnd,
    });

    const snapshot = await service.resolveForUser('user-1');

    expect(snapshot.isPremium).toBe(true);
    expect(snapshot.isTrial).toBe(false);
    expect(snapshot.premiumUntil).toBe(periodEnd.toISOString());
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'ACTIVE', plan: { in: ['PREMIUM_MONTHLY', 'PREMIUM_YEARLY'] } },
      orderBy: { currentPeriodEnd: 'desc' },
    });
  });

  it('usuário sem trial e sem subscription não tem acesso Premium', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      subscriptionStatus: 'NONE',
      trialEndsAt: null,
    });
    prisma.subscription.findFirst.mockResolvedValue(null);

    const snapshot = await service.resolveForUser('user-1');

    expect(snapshot.isPremium).toBe(false);
    expect(snapshot.isTrial).toBe(false);
  });

  it('devolve snapshot do cache Redis sem consultar o banco quando disponível', async () => {
    const cached = {
      isPremium: true,
      isTrial: false,
      trialEndsAt: null,
      premiumUntil: null,
      features: {},
      resolvedAt: new Date().toISOString(),
    };
    cache.get.mockResolvedValue(cached);

    const snapshot = await service.resolveForUser('user-1');

    expect(snapshot).toBe(cached);
    expect(prisma.user.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('invalidate() remove a chave de cache do usuário', async () => {
    await service.invalidate('user-1');
    expect(cache.del).toHaveBeenCalledWith('entitlements:user-1');
  });
});
