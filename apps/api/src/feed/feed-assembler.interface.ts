import { CursorPage } from '../common/pagination/cursor.util';
import { PostSummaryDto } from '../posts/post-mapper';

// Token de DI: o controller depende só desta interface (seção 5.2 —
// "isolar a montagem do feed atrás de uma interface, permitindo trocar por
// timeline pré-computada no futuro sem tocar no resto").
export const FEED_ASSEMBLER = 'FEED_ASSEMBLER';

export interface FeedAssembler {
  /** Aba "Seguindo": só posts de quem o usuário segue, ordem estritamente cronológica. */
  assembleFollowingFeed(userId: string, cursor?: string): Promise<CursorPage<PostSummaryDto>>;

  /** Aba "Para você": posts públicos de quem o usuário não segue, recência + leve boost de engajamento. */
  assembleForYouFeed(userId: string, cursor?: string): Promise<CursorPage<PostSummaryDto>>;
}
