import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DomainEvent } from '../queue/queue.constants';
import { AchievementsService } from './achievements.service';

describe('AchievementsService', () => {
  let service: AchievementsService;
  let prisma: {
    achievement: { findMany: jest.Mock };
    userAchievement: { createMany: jest.Mock; findMany: jest.Mock };
    review: { count: jest.Mock };
    humidorItem: { count: jest.Mock };
    cigar: { count: jest.Mock };
    user: { findUnique: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let notifications: { create: jest.Mock };

  const firstReviewAchievement = {
    id: 'ach-1',
    code: 'FIRST_REVIEW',
    name: 'Primeira Avaliação',
    description: 'Avalie seu primeiro charuto',
    icon: 'medal',
    tier: 1,
    rule: { type: 'count', event: DomainEvent.REVIEW_CREATED, target: 1 },
  };

  beforeEach(async () => {
    prisma = {
      achievement: { findMany: jest.fn() },
      userAchievement: { createMany: jest.fn(), findMany: jest.fn() },
      review: { count: jest.fn() },
      humidorItem: { count: jest.fn() },
      cigar: { count: jest.fn() },
      user: { findUnique: jest.fn() },
      $queryRaw: jest.fn(),
    };
    notifications = { create: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AchievementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(AchievementsService);
  });

  describe('idempotência com evento duplicado na fila', () => {
    it('desbloqueia o selo e notifica exatamente uma vez, mesmo processando o mesmo evento duas vezes', async () => {
      prisma.achievement.findMany.mockResolvedValue([firstReviewAchievement]);
      prisma.review.count.mockResolvedValue(1); // usuário já tem 1 review >= target

      // Primeira vez: a linha ainda não existe -> createMany insere (count 1).
      // Segunda vez (job duplicado): a constraint composta userId_achievementId
      // já existe -> skipDuplicates faz o Postgres não inserir nada (count 0).
      prisma.userAchievement.createMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

      const payload = { userId: 'user-1', reviewId: 'r1', cigarId: 'c1', cigarCountryCode: 'BR', cigarVitola: null };

      await service.evaluateEvent(DomainEvent.REVIEW_CREATED, payload);
      await service.evaluateEvent(DomainEvent.REVIEW_CREATED, payload);

      expect(prisma.userAchievement.createMany).toHaveBeenCalledTimes(2);
      expect(prisma.userAchievement.createMany).toHaveBeenCalledWith({
        data: [{ userId: 'user-1', achievementId: 'ach-1' }],
        skipDuplicates: true,
      });
      // A notificação só é criada quando createMany de fato insere (count === 1).
      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(notifications.create).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'ACHIEVEMENT_UNLOCKED',
        entityType: 'Achievement',
        entityId: 'ach-1',
      });
    });

    it('não desbloqueia nem notifica quando a regra ainda não foi satisfeita', async () => {
      prisma.achievement.findMany.mockResolvedValue([firstReviewAchievement]);
      prisma.review.count.mockResolvedValue(0);

      await service.evaluateEvent(DomainEvent.REVIEW_CREATED, {
        userId: 'user-1',
        reviewId: 'r1',
        cigarId: 'c1',
        cigarCountryCode: 'BR',
        cigarVitola: null,
      });

      expect(prisma.userAchievement.createMany).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('ignora FOLLOW_ACCEPTED quando becameFriends não é true', async () => {
      await service.evaluateEvent(DomainEvent.FOLLOW_ACCEPTED, {
        userId: 'user-1',
        otherUserId: 'user-2',
        becameFriends: false,
      });

      expect(prisma.achievement.findMany).not.toHaveBeenCalled();
    });

    it('avalia FOLLOW_ACCEPTED com becameFriends true a partir do friendCount real do usuário', async () => {
      const friendsAchievement = {
        id: 'ach-friends-10',
        code: 'FRIENDS_10',
        name: '10 Amigos',
        description: '',
        icon: 'people',
        tier: 1,
        rule: { type: 'count', event: DomainEvent.FOLLOW_ACCEPTED, target: 10 },
      };
      prisma.achievement.findMany.mockResolvedValue([friendsAchievement]);
      prisma.user.findUnique.mockResolvedValue({ friendCount: 10 });
      prisma.userAchievement.createMany.mockResolvedValue({ count: 1 });

      await service.evaluateEvent(DomainEvent.FOLLOW_ACCEPTED, {
        userId: 'user-1',
        otherUserId: 'user-2',
        becameFriends: true,
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { friendCount: true },
      });
      expect(notifications.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProgressForUser', () => {
    it('calcula progresso real (3 de 5) para conquista ainda não desbloqueada', async () => {
      const reviews5 = {
        id: 'ach-5',
        code: 'REVIEWS_5',
        name: '5 Avaliações',
        description: '',
        icon: 'star',
        tier: 1,
        createdAt: new Date(),
        rule: { type: 'count', event: DomainEvent.REVIEW_CREATED, target: 5 },
      };
      prisma.achievement.findMany.mockResolvedValue([reviews5]);
      prisma.userAchievement.findMany.mockResolvedValue([]);
      prisma.review.count.mockResolvedValue(3);

      const result = await service.getProgressForUser('user-1');

      expect(result).toEqual([
        {
          code: 'REVIEWS_5',
          name: '5 Avaliações',
          description: '',
          icon: 'star',
          tier: 1,
          unlockedAt: null,
          progress: 0.6,
        },
      ]);
    });

    it('retorna progress 1 e unlockedAt preenchido para conquista já desbloqueada', async () => {
      const unlockedAt = new Date('2026-01-01T00:00:00.000Z');
      const achievement = {
        id: 'ach-1',
        code: 'FIRST_REVIEW',
        name: 'Primeira Avaliação',
        description: '',
        icon: 'medal',
        tier: 1,
        createdAt: new Date(),
        rule: { type: 'count', event: DomainEvent.REVIEW_CREATED, target: 1 },
      };
      prisma.achievement.findMany.mockResolvedValue([achievement]);
      prisma.userAchievement.findMany.mockResolvedValue([{ achievementId: 'ach-1', unlockedAt }]);

      const result = await service.getProgressForUser('user-1');

      expect(result).toEqual([
        {
          code: 'FIRST_REVIEW',
          name: 'Primeira Avaliação',
          description: '',
          icon: 'medal',
          tier: 1,
          unlockedAt: unlockedAt.toISOString(),
          progress: 1,
        },
      ]);
      // Já desbloqueada: não deve nem consultar a query de contagem real.
      expect(prisma.review.count).not.toHaveBeenCalled();
    });
  });
});
