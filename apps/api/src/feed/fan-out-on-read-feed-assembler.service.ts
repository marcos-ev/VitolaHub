import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VisibilityService } from '../common/visibility/visibility.service';
import { CursorPage, DEFAULT_PAGE_SIZE, decodeCursor, paginateResults } from '../common/pagination/cursor.util';
import { PrismaService } from '../prisma/prisma.service';
import { buildPostInclude, mapPostToSummary, PostSummaryDto, PostWithRelations } from '../posts/post-mapper';
import { FeedAssembler } from './feed-assembler.interface';

/**
 * Implementação fan-out-on-read (seção 5.2): a base de usuários é pequena
 * (~5 mil), então montar o feed em tempo de leitura é suficiente — nenhuma
 * timeline pré-computada. Ambas as abas partem de
 * `VisibilityService.buildPostWhereVisibleTo`, nunca reimplementando a
 * regra de visibilidade, e paginam sempre por cursor (createdAt + id).
 */
@Injectable()
export class FanOutOnReadFeedAssembler implements FeedAssembler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
  ) {}

  async assembleFollowingFeed(userId: string, cursorRaw?: string): Promise<CursorPage<PostSummaryDto>> {
    const cursor = decodeCursor(cursorRaw);

    const where: Prisma.PostWhereInput = {
      AND: [
        this.visibility.buildPostWhereVisibleTo(userId),
        { author: { followerEdges: { some: { followerId: userId, status: 'ACCEPTED' } } } },
        ...(cursor
          ? [
              {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              } satisfies Prisma.PostWhereInput,
            ]
          : []),
      ],
    };

    const posts = await this.prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: DEFAULT_PAGE_SIZE + 1,
      include: buildPostInclude(userId),
    });

    const page = paginateResults(posts, DEFAULT_PAGE_SIZE);
    return {
      items: page.items.map((post) => mapPostToSummary(post as PostWithRelations, userId)),
      nextCursor: page.nextCursor,
    };
  }

  async assembleForYouFeed(userId: string, cursorRaw?: string): Promise<CursorPage<PostSummaryDto>> {
    const cursor = decodeCursor(cursorRaw);

    const where: Prisma.PostWhereInput = {
      AND: [
        this.visibility.buildPostWhereVisibleTo(userId),
        { visibility: 'PUBLIC' },
        { authorId: { not: userId } },
        // Não segue ainda — posts de quem já sigo pertencem à aba "Seguindo".
        { author: { followerEdges: { none: { followerId: userId, status: 'ACCEPTED' } } } },
        // Exclui bloqueados nos dois sentidos.
        { author: { followerEdges: { none: { followerId: userId, status: 'BLOCKED' } } } },
        { author: { followingEdges: { none: { followeeId: userId, status: 'BLOCKED' } } } },
        ...(cursor
          ? [
              {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              } satisfies Prisma.PostWhereInput,
            ]
          : []),
      ],
    };

    const posts = await this.prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: DEFAULT_PAGE_SIZE + 1,
      include: buildPostInclude(userId),
    });

    const page = paginateResults(posts, DEFAULT_PAGE_SIZE);

    // Boost leve de engajamento: a busca no banco já define o cursor da
    // próxima página estritamente por (createdAt, id) — o boost apenas
    // reordena os itens dentro da própria página já buscada, nunca atravessa
    // fronteiras de página (o que quebraria a paginação por cursor).
    const rankedItems = [...page.items].sort((a, b) => {
      const scoreA = a.createdAt.getTime() + Math.min(a.likeCount + a.commentCount * 2, 50) * 60_000;
      const scoreB = b.createdAt.getTime() + Math.min(b.likeCount + b.commentCount * 2, 50) * 60_000;
      return scoreB - scoreA;
    });

    return {
      items: rankedItems.map((post) => mapPostToSummary(post as PostWithRelations, userId)),
      nextCursor: page.nextCursor,
    };
  }
}
