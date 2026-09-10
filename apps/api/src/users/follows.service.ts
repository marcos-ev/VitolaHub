import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CountersService } from '../queue/counters.service';
import { DomainEventsService } from '../queue/domain-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DomainEvent } from '../queue/queue.constants';

/**
 * Modelo híbrido de relacionamento (seção 5.1): seguir assimétrico em perfis
 * abertos, amizade mútua (duas arestas ACCEPTED) em perfis fechados. Amizade
 * é sempre derivada por reciprocidade — nunca uma tabela separada.
 */
@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CountersService,
    private readonly domainEvents: DomainEventsService,
    private readonly notifications: NotificationsService,
  ) {}

  async follow(followerId: string, followeeId: string) {
    if (followerId === followeeId) {
      throw new BadRequestException('Você não pode seguir a si mesmo');
    }

    const followee = await this.prisma.user.findUnique({ where: { id: followeeId } });
    if (!followee || followee.status !== 'ACTIVE') throw new NotFoundException('Usuário não encontrado');

    await this.assertNotBlocked(followerId, followeeId);

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId, followeeId } },
    });
    if (existing && existing.status !== 'BLOCKED') {
      return existing; // idempotente: já segue ou já pediu
    }

    if (followee.isPrivate) {
      const request = await this.prisma.follow.upsert({
        where: { followerId_followeeId: { followerId, followeeId } },
        create: { followerId, followeeId, status: 'PENDING' },
        update: { status: 'PENDING' },
      });
      await this.notifications.create({
        userId: followeeId,
        type: 'FOLLOW_REQUEST',
        actorId: followerId,
      });
      return request;
    }

    // Perfil aberto: entra direto como ACCEPTED em um sentido só.
    const edge = await this.prisma.follow.upsert({
      where: { followerId_followeeId: { followerId, followeeId } },
      create: { followerId, followeeId, status: 'ACCEPTED' },
      update: { status: 'ACCEPTED' },
    });

    await this.counters.recomputeFollowCounts(followerId);
    await this.counters.recomputeFollowCounts(followeeId);

    // "Um usuário de perfil aberto também pode virar amigo: basta que os dois
    // se sigam" — a reciprocidade é o único critério, então checamos aqui.
    const reciprocal = await this.prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId: followeeId, followeeId: followerId } },
    });
    const becameFriends = reciprocal?.status === 'ACCEPTED';
    if (becameFriends) {
      await this.counters.recomputeFriendCount(followerId);
      await this.counters.recomputeFriendCount(followeeId);
      await this.domainEvents.publish(DomainEvent.FOLLOW_ACCEPTED, {
        userId: followerId,
        otherUserId: followeeId,
        becameFriends: true,
      });
      await this.domainEvents.publish(DomainEvent.FOLLOW_ACCEPTED, {
        userId: followeeId,
        otherUserId: followerId,
        becameFriends: true,
      });
    }

    return edge;
  }

  /** Aceitar solicitação: cria automaticamente a aresta recíproca (amizade mútua). */
  async acceptRequest(currentUserId: string, followerId: string) {
    const request = await this.prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId, followeeId: currentUserId } },
    });
    if (!request || request.status !== 'PENDING') {
      throw new NotFoundException('Solicitação não encontrada');
    }

    await this.prisma.$transaction([
      this.prisma.follow.update({
        where: { followerId_followeeId: { followerId, followeeId: currentUserId } },
        data: { status: 'ACCEPTED' },
      }),
      this.prisma.follow.upsert({
        where: { followerId_followeeId: { followerId: currentUserId, followeeId: followerId } },
        create: { followerId: currentUserId, followeeId: followerId, status: 'ACCEPTED' },
        update: { status: 'ACCEPTED' },
      }),
    ]);

    await Promise.all([
      this.counters.recomputeFollowCounts(followerId),
      this.counters.recomputeFollowCounts(currentUserId),
      this.counters.recomputeFriendCount(followerId),
      this.counters.recomputeFriendCount(currentUserId),
    ]);

    await this.domainEvents.publish(DomainEvent.FOLLOW_ACCEPTED, {
      userId: followerId,
      otherUserId: currentUserId,
      becameFriends: true,
    });
    await this.domainEvents.publish(DomainEvent.FOLLOW_ACCEPTED, {
      userId: currentUserId,
      otherUserId: followerId,
      becameFriends: true,
    });

    await this.notifications.create({
      userId: followerId,
      type: 'FOLLOW_ACCEPTED',
      actorId: currentUserId,
    });
  }

  async rejectRequest(currentUserId: string, followerId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId, followeeId: currentUserId, status: 'PENDING' },
    });
  }

  async unfollow(followerId: string, followeeId: string) {
    await this.prisma.follow.deleteMany({ where: { followerId, followeeId } });
    await this.counters.recomputeFollowCounts(followerId);
    await this.counters.recomputeFollowCounts(followeeId);
    await this.counters.recomputeFriendCount(followerId);
    await this.counters.recomputeFriendCount(followeeId);
  }

  /** Bloqueio bidirecional (seção 5.1): remove as duas arestas e impede nova interação. */
  async block(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException('Ação inválida');

    await this.prisma.$transaction([
      this.prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: userId, followeeId: targetId },
            { followerId: targetId, followeeId: userId },
          ],
        },
      }),
      this.prisma.follow.create({ data: { followerId: userId, followeeId: targetId, status: 'BLOCKED' } }),
      this.prisma.follow.create({ data: { followerId: targetId, followeeId: userId, status: 'BLOCKED' } }),
    ]);

    await Promise.all([
      this.counters.recomputeFollowCounts(userId),
      this.counters.recomputeFollowCounts(targetId),
      this.counters.recomputeFriendCount(userId),
      this.counters.recomputeFriendCount(targetId),
    ]);
  }

  /** Desbloqueio: única forma de reverter um bloqueio, sempre uma ação explícita. */
  async unblock(userId: string, targetId: string) {
    await this.prisma.follow.deleteMany({
      where: {
        status: 'BLOCKED',
        OR: [
          { followerId: userId, followeeId: targetId },
          { followerId: targetId, followeeId: userId },
        ],
      },
    });
  }

  async listFollowers(userId: string) {
    return this.prisma.follow.findMany({
      where: { followeeId: userId, status: 'ACCEPTED' },
      include: { follower: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listFollowing(userId: string) {
    return this.prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      include: { followee: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listBlocked(userId: string) {
    return this.prisma.follow.findMany({
      where: { followerId: userId, status: 'BLOCKED' },
      include: { followee: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPendingRequests(userId: string) {
    return this.prisma.follow.findMany({
      where: { followeeId: userId, status: 'PENDING' },
      include: { follower: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertNotBlocked(userAId: string, userBId: string) {
    const blocked = await this.prisma.follow.findFirst({
      where: {
        status: 'BLOCKED',
        OR: [
          { followerId: userAId, followeeId: userBId },
          { followerId: userBId, followeeId: userAId },
        ],
      },
    });
    if (blocked) throw new ForbiddenException('Ação não permitida entre estes usuários');
  }
}
