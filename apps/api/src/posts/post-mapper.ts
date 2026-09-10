import { Prisma } from '@prisma/client';

// Include reutilizado por posts (detalhe/listagem) e pelo feed — mantém o
// card do post consistente em todo o backend, com `likedByMe` calculado via
// filtro na própria relação (sem N+1 de uma query por post).
export function buildPostInclude(currentUserId: string | null): Prisma.PostInclude {
  return {
    author: {
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        city: true,
        state: true,
        isPrivate: true,
        accountType: true,
        followerCount: true,
        followingCount: true,
        friendCount: true,
      },
    },
    cigar: { include: { brand: true } },
    media: { orderBy: { position: 'asc' } },
    likes: currentUserId ? { where: { userId: currentUserId }, select: { userId: true } } : false,
  };
}

export type PostWithRelations = Prisma.PostGetPayload<{
  include: {
    author: {
      select: {
        id: true;
        username: true;
        displayName: true;
        avatarUrl: true;
        bio: true;
        city: true;
        state: true;
        isPrivate: true;
        accountType: true;
        followerCount: true;
        followingCount: true;
        friendCount: true;
      };
    };
    cigar: { include: { brand: true } };
    media: true;
    likes: true;
  };
}>;

export interface PostSummaryDto {
  id: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isPrivate: boolean;
  };
  cigar: {
    id: string;
    name: string;
    line: string | null;
    brand: { id: string; name: string };
    countryCode: string;
    vitola: string | null;
    ratingAvg: number;
    ratingCount: number;
    imageUrl: string | null;
  } | null;
  body: string | null;
  visibility: string;
  likeCount: number;
  commentCount: number;
  media: { id: string; url: string; thumbUrl: string; width: number; height: number; position: number }[];
  likedByMe: boolean;
  createdAt: Date;
}

export function mapPostToSummary(post: PostWithRelations, currentUserId: string | null): PostSummaryDto {
  return {
    id: post.id,
    author: {
      id: post.author.id,
      username: post.author.username,
      displayName: post.author.displayName,
      avatarUrl: post.author.avatarUrl,
      isPrivate: post.author.isPrivate,
    },
    cigar: post.cigar
      ? {
          id: post.cigar.id,
          name: post.cigar.name,
          line: post.cigar.line,
          brand: { id: post.cigar.brand.id, name: post.cigar.brand.name },
          countryCode: post.cigar.countryCode,
          vitola: post.cigar.vitola,
          ratingAvg: Number(post.cigar.ratingAvg),
          ratingCount: post.cigar.ratingCount,
          imageUrl: post.cigar.imageUrl,
        }
      : null,
    body: post.body,
    visibility: post.visibility,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    media: post.media
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((m) => ({ id: m.id, url: m.url, thumbUrl: m.thumbUrl, width: m.width, height: m.height, position: m.position })),
    likedByMe: currentUserId ? (post.likes?.length ?? 0) > 0 : false,
    createdAt: post.createdAt,
  };
}
