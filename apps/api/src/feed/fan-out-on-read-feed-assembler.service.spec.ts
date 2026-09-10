import { Test } from '@nestjs/testing';
import { VisibilityService } from '../common/visibility/visibility.service';
import { PrismaService } from '../prisma/prisma.service';
import { FanOutOnReadFeedAssembler } from './fan-out-on-read-feed-assembler.service';

function makePost(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? 'post-1',
    authorId: 'author-1',
    body: 'Um bom charuto',
    visibility: 'PUBLIC',
    likeCount: 0,
    commentCount: 0,
    createdAt: overrides.createdAt ?? new Date('2026-08-01T10:00:00Z'),
    cigar: null,
    media: [],
    likes: [],
    author: {
      id: 'author-1',
      username: 'fulano',
      displayName: 'Fulano',
      avatarUrl: null,
      isPrivate: false,
      bio: null,
      city: null,
      state: null,
      accountType: 'PF',
      followerCount: 0,
      followingCount: 0,
      friendCount: 0,
    },
    ...overrides,
  };
}

describe('FanOutOnReadFeedAssembler', () => {
  let assembler: FanOutOnReadFeedAssembler;
  let prisma: { post: { findMany: jest.Mock } };
  let visibility: { buildPostWhereVisibleTo: jest.Mock };

  const visibilityClause = { deletedAt: null, visibility: 'PUBLIC', author: { isPrivate: false } };

  beforeEach(async () => {
    prisma = { post: { findMany: jest.fn().mockResolvedValue([]) } };
    visibility = { buildPostWhereVisibleTo: jest.fn().mockReturnValue(visibilityClause) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FanOutOnReadFeedAssembler,
        { provide: PrismaService, useValue: prisma },
        { provide: VisibilityService, useValue: visibility },
      ],
    }).compile();

    assembler = moduleRef.get(FanOutOnReadFeedAssembler);
  });

  describe('assembleFollowingFeed', () => {
    it('sempre parte da cláusula de VisibilityService.buildPostWhereVisibleTo, nunca reimplementando a regra', async () => {
      await assembler.assembleFollowingFeed('user-1');

      expect(visibility.buildPostWhereVisibleTo).toHaveBeenCalledWith('user-1');
      const whereArg = prisma.post.findMany.mock.calls[0][0].where;
      expect(whereArg.AND).toContainEqual(visibilityClause);
    });

    it('restringe a somente autores seguidos (ACCEPTED)', async () => {
      await assembler.assembleFollowingFeed('user-1');

      const whereArg = prisma.post.findMany.mock.calls[0][0].where;
      expect(whereArg.AND).toContainEqual({
        author: { followerEdges: { some: { followerId: 'user-1', status: 'ACCEPTED' } } },
      });
    });

    it('ordena estritamente por createdAt/id decrescente (cronológico)', async () => {
      await assembler.assembleFollowingFeed('user-1');

      const args = prisma.post.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    });

    it('mapeia os posts retornados para o formato de card do feed', async () => {
      prisma.post.findMany.mockResolvedValue([makePost({ id: 'post-1' })]);

      const result = await assembler.assembleFollowingFeed('user-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'post-1',
        author: { id: 'author-1', username: 'fulano' },
        likedByMe: false,
      });
      expect(result.nextCursor).toBeNull();
    });

    it('gera nextCursor quando há mais itens do que o tamanho da página (20)', async () => {
      const posts = Array.from({ length: 21 }, (_, i) =>
        makePost({ id: `post-${i}`, createdAt: new Date(Date.now() - i * 1000) }),
      );
      prisma.post.findMany.mockResolvedValue(posts);

      const result = await assembler.assembleFollowingFeed('user-1');

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).not.toBeNull();
    });
  });

  describe('assembleForYouFeed', () => {
    it('usa a cláusula de visibilidade, filtra só PUBLIC, exclui o próprio autor, não-seguidos e bloqueados', async () => {
      await assembler.assembleForYouFeed('user-1');

      const whereArg = prisma.post.findMany.mock.calls[0][0].where;
      expect(visibility.buildPostWhereVisibleTo).toHaveBeenCalledWith('user-1');
      expect(whereArg.AND).toContainEqual(visibilityClause);
      expect(whereArg.AND).toContainEqual({ visibility: 'PUBLIC' });
      expect(whereArg.AND).toContainEqual({ authorId: { not: 'user-1' } });
      expect(whereArg.AND).toContainEqual({
        author: { followerEdges: { none: { followerId: 'user-1', status: 'ACCEPTED' } } },
      });
      expect(whereArg.AND).toContainEqual({
        author: { followerEdges: { none: { followerId: 'user-1', status: 'BLOCKED' } } },
      });
      expect(whereArg.AND).toContainEqual({
        author: { followingEdges: { none: { followeeId: 'user-1', status: 'BLOCKED' } } },
      });
    });

    it('aplica um leve boost de engajamento sem quebrar a origem do cursor (createdAt/id)', async () => {
      const older = makePost({
        id: 'low-engagement',
        createdAt: new Date('2026-08-01T08:00:00Z'),
        likeCount: 0,
        commentCount: 0,
      });
      const newer = makePost({
        id: 'high-engagement',
        createdAt: new Date('2026-08-01T07:59:00Z'),
        likeCount: 100,
        commentCount: 50,
      });
      prisma.post.findMany.mockResolvedValue([older, newer]);

      const result = await assembler.assembleForYouFeed('user-1');

      expect(result.items.map((i) => i.id)).toEqual(['high-engagement', 'low-engagement']);
    });
  });
});
