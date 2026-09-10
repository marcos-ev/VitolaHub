import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PublicUser } from '@charuto/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService, CacheTTL } from '../redis/cache.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getProfileByUsername(username: string, currentUserId: string | null): Promise<PublicUser> {
    const cacheKey = `profile:${username}`;
    const cached = currentUserId === null ? await this.cache.get<PublicUser>(cacheKey) : null;
    if (cached) return cached;

    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null, status: 'ACTIVE' },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    let isFollowedByMe: 'PENDING' | 'ACCEPTED' | 'BLOCKED' | null = null;
    let isFriendWithMe = false;

    if (currentUserId && currentUserId !== user.id) {
      const [myEdge, reverseEdge] = await Promise.all([
        this.prisma.follow.findUnique({
          where: { followerId_followeeId: { followerId: currentUserId, followeeId: user.id } },
        }),
        this.prisma.follow.findUnique({
          where: { followerId_followeeId: { followerId: user.id, followeeId: currentUserId } },
        }),
      ]);
      isFollowedByMe = myEdge?.status ?? null;
      isFriendWithMe = myEdge?.status === 'ACCEPTED' && reverseEdge?.status === 'ACCEPTED';
    }

    const publicUser: PublicUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      city: user.city,
      state: user.state,
      isPrivate: user.isPrivate,
      accountType: user.accountType,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      friendCount: user.friendCount,
      isFollowedByMe,
      isFriendWithMe,
    };

    if (currentUserId === null) {
      await this.cache.set(cacheKey, publicUser, CacheTTL.PUBLIC_PROFILE);
    }

    return publicUser;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: dto });
    await this.cache.del(`profile:${user.username}`);
    return user;
  }

  /**
   * Troca de privacidade do perfil (seção 5.1). Regras de transição:
   * - aberto -> fechado: seguidores existentes permanecem ACCEPTED (não viram amigos).
   * - fechado -> aberto: solicitações PENDING são aceitas automaticamente como
   *   seguidores simples, SEM criar a aresta recíproca (não vira amizade).
   */
  async setPrivacy(userId: string, isPrivate: boolean) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.isPrivate === isPrivate) {
      return user;
    }

    if (user.isPrivate && !isPrivate) {
      await this.prisma.follow.updateMany({
        where: { followeeId: userId, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data: { isPrivate } });
    await this.cache.del(`profile:${updated.username}`);
    return updated;
  }

  /**
   * Busca de pessoas por username/nome (tela Explorar). Sem endpoint dedicado
   * na especificação original — implementado seguindo a mesma convenção de
   * exclusão de bloqueados usada em `assertNotBlocked`, nunca reimplementando
   * a regra de bloqueio em outro lugar.
   */
  async search(query: string, currentUserId: string | null, limit = 20): Promise<PublicUser[]> {
    const excludeIds = await this.blockedUserIds(currentUserId);
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        id: { notIn: excludeIds },
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { followerCount: 'desc' },
      take: limit,
    });
    return users.map((u) => this.toBasicPublicUser(u));
  }

  /**
   * "Pessoas sugeridas" da tela Explorar: perfis com mais seguidores que o
   * usuário atual ainda não segue (proxy simples de relevância — sem grafo
   * social suficiente para algo mais sofisticado neste estágio do produto).
   */
  async suggested(currentUserId: string | null, limit = 10): Promise<PublicUser[]> {
    const excludeIds = await this.blockedUserIds(currentUserId);
    if (currentUserId) {
      const following = await this.prisma.follow.findMany({
        where: { followerId: currentUserId },
        select: { followeeId: true },
      });
      excludeIds.push(currentUserId, ...following.map((f) => f.followeeId));
    }

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, status: 'ACTIVE', id: { notIn: excludeIds } },
      orderBy: { followerCount: 'desc' },
      take: limit,
    });
    return users.map((u) => this.toBasicPublicUser(u));
  }

  private async blockedUserIds(currentUserId: string | null): Promise<string[]> {
    if (!currentUserId) return [];
    const blocks = await this.prisma.follow.findMany({
      where: { status: 'BLOCKED', OR: [{ followerId: currentUserId }, { followeeId: currentUserId }] },
      select: { followerId: true, followeeId: true },
    });
    return blocks.map((b) => (b.followerId === currentUserId ? b.followeeId : b.followerId));
  }

  private toBasicPublicUser(user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    city: string | null;
    state: string | null;
    isPrivate: boolean;
    accountType: PublicUser['accountType'];
    followerCount: number;
    followingCount: number;
    friendCount: number;
  }): PublicUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      city: user.city,
      state: user.state,
      isPrivate: user.isPrivate,
      accountType: user.accountType,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      friendCount: user.friendCount,
      isFollowedByMe: null,
      isFriendWithMe: false,
    };
  }

  async getUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async assertNotBlocked(userAId: string, userBId: string) {
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

  async report(targetUserId: string, reporterId: string, reason: string) {
    if (targetUserId === reporterId) {
      throw new ForbiddenException('Você não pode denunciar a si mesmo');
    }
    await this.getUserOrThrow(targetUserId);
    return this.prisma.report.create({
      data: { reporterId, entityType: 'USER', entityId: targetUserId, reason },
    });
  }

  /**
   * Encerramento de conta (Play / LGPD): soft delete + anonimiza únicos
   * para o e-mail/username/CPF poderem ser reutilizados.
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'DELETED') {
      throw new NotFoundException('Usuário não encontrado');
    }

    const now = new Date();
    const tombstone = userId.replace(/-/g, '').slice(0, 24);

    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.post.updateMany({
        where: { authorId: userId, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.comment.updateMany({
        where: { authorId: userId, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: 'DELETED',
          deletedAt: now,
          email: `deleted+${tombstone}@invalid.local`,
          username: `del_${tombstone}`.slice(0, 30),
          displayName: 'Conta encerrada',
          bio: null,
          avatarUrl: null,
          city: null,
          state: null,
          taxId: null,
          passwordHash: null,
          expoPushToken: null,
          appleSub: null,
          googleSub: null,
        },
      }),
    ]);

    await this.cache.del(`profile:${user.username}`);
  }
}
