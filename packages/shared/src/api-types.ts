// Contratos de payload compartilhados entre mobile e API. Mantidos como tipos
// puros (sem decorators) para poderem ser importados pelo Metro bundler sem
// depender de reflect-metadata/class-validator, que só existem no backend.

export type AccountType = 'PF' | 'PJ';
export type PostVisibility = 'PUBLIC' | 'FRIENDS';
export type FollowStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  isPrivate: boolean;
  accountType: AccountType;
  followerCount: number;
  followingCount: number;
  friendCount: number;
  isFollowedByMe?: FollowStatus | null;
  isFriendWithMe?: boolean;
}

export interface CigarSummary {
  id: string;
  name: string;
  line: string | null;
  brand: { id: string; name: string };
  countryCode: string;
  vitola: string | null;
  ratingAvg: number;
  ratingCount: number;
  imageUrl: string | null;
}

export interface PostSummary {
  id: string;
  author: PublicUser;
  cigar: CigarSummary | null;
  body: string | null;
  visibility: PostVisibility;
  likeCount: number;
  commentCount: number;
  media: { url: string; thumbUrl: string; width: number; height: number }[];
  likedByMe: boolean;
  createdAt: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AchievementProgress {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: number;
  unlockedAt: string | null;
  progress: number; // 0..1
  current: number;
  target: number;
}
