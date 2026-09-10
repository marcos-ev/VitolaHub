import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Camada única de visibilidade (seção 5.1). Toda leitura de posts em todo o
 * backend — feed, perfil, explorar, detalhe — deve filtrar através de
 * `buildPostWhereVisibleTo`. Nunca reimplemente esta regra em uma rota.
 *
 *   podeVer(post, usuarioAtual) =
 *     post.author_id == usuarioAtual
 *     OU (post.visibility == PUBLIC E author.is_private == false)
 *     OU (post.visibility == PUBLIC E existe follow(usuarioAtual -> author) ACCEPTED)
 *     OU (post.visibility == FRIENDS E saoAmigos(usuarioAtual, author))
 *
 *   saoAmigos(A, B) =
 *     existe follow(A -> B) ACCEPTED E existe follow(B -> A) ACCEPTED
 */
@Injectable()
export class VisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cláusula Prisma reutilizável por qualquer listagem de posts. `currentUserId`
   * nulo representa um visitante anônimo (só enxerga público de perfil aberto).
   */
  buildPostWhereVisibleTo(currentUserId: string | null): Prisma.PostWhereInput {
    const base: Prisma.PostWhereInput = { deletedAt: null };

    if (!currentUserId) {
      return { ...base, visibility: 'PUBLIC', author: { isPrivate: false } };
    }

    const isAuthor: Prisma.PostWhereInput = { authorId: currentUserId };

    const publicFromOpenProfile: Prisma.PostWhereInput = {
      visibility: 'PUBLIC',
      author: { isPrivate: false },
    };

    const publicFromFollowedClosedProfile: Prisma.PostWhereInput = {
      visibility: 'PUBLIC',
      author: {
        followerEdges: { some: { followerId: currentUserId, status: 'ACCEPTED' } },
      },
    };

    const friendsOnly: Prisma.PostWhereInput = {
      visibility: 'FRIENDS',
      author: {
        followerEdges: { some: { followerId: currentUserId, status: 'ACCEPTED' } },
        followingEdges: { some: { followeeId: currentUserId, status: 'ACCEPTED' } },
      },
    };

    return {
      ...base,
      OR: [isAuthor, publicFromOpenProfile, publicFromFollowedClosedProfile, friendsOnly],
    };
  }

  /**
   * Checagem de item único. Reutiliza a mesma cláusula da listagem — nunca
   * reimplementa a regra — para garantir que detalhe e feed nunca divirjam.
   */
  async canViewPost(postId: string, currentUserId: string | null): Promise<boolean> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, ...this.buildPostWhereVisibleTo(currentUserId) },
      select: { id: true },
    });
    return post !== null;
  }

  /** saoAmigos(A, B): reciprocidade de ACCEPTED nos dois sentidos. */
  async areFriends(userAId: string, userBId: string): Promise<boolean> {
    if (userAId === userBId) return false;
    const [aToB, bToA] = await Promise.all([
      this.prisma.follow.findUnique({
        where: { followerId_followeeId: { followerId: userAId, followeeId: userBId } },
        select: { status: true },
      }),
      this.prisma.follow.findUnique({
        where: { followerId_followeeId: { followerId: userBId, followeeId: userAId } },
        select: { status: true },
      }),
    ]);
    return aToB?.status === 'ACCEPTED' && bToA?.status === 'ACCEPTED';
  }

  /** Cláusula reutilizável para "perfil visível" fora do contexto de post (ex.: busca). */
  canViewProfileWhere(currentUserId: string | null): Prisma.UserWhereInput {
    if (!currentUserId) return { isPrivate: false };
    return {
      OR: [
        { id: currentUserId },
        { isPrivate: false },
        { followerEdges: { some: { followerId: currentUserId, status: 'ACCEPTED' } } },
      ],
    };
  }
}
