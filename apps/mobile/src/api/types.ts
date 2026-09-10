import { CigarSummary, CursorPage, PostSummary, PostVisibility, PublicUser } from '@charuto/shared';

// Tipos locais do mobile que documentam o contrato REAL (ou esperado, quando
// o endpoint ainda estava em construção no momento da implementação desta
// tela) trocado com a API. Ver resumo final do agente para a lista completa
// de suposições feitas sobre endpoints que ainda não existiam.

export interface LoginPayload {
  /** Nome de usuário ou e-mail. */
  identifier: string;
  password: string;
}

export interface RegisterPayload {
  /** Opcional — se omitido, a API gera um e-mail interno a partir do username. */
  email?: string;
  password: string;
  username: string;
  displayName: string;
  birthDate: string; // ISO 8601 (yyyy-MM-dd)
  taxId: string; // CPF (11) ou CNPJ (14), só dígitos
  accountType: 'PF' | 'PJ';
  acceptedTerms: boolean;
  installationId?: string;
  inviteCode?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
}

// --- Catálogo -------------------------------------------------------------

// GET /catalog/cigars/search — confirmado contra apps/api/src/catalog: os
// campos batem com CigarSummary (@charuto/shared), com `status`/`score`
// extras que ignoramos no cliente.
export type CigarSearchItem = CigarSummary;

export interface CigarBrandDetail {
  id: string;
  name: string;
  countryCode: string;
}

export interface CigarReviewSummary {
  id: string;
  rating: number;
  body: string | null;
  pairedWith: string | null;
  user: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  flavorNotes: string[];
  createdAt: string;
}

// GET /catalog/cigars/:id — confirmado contra CatalogService.getById.
export interface CigarDetail {
  id: string;
  name: string;
  line: string | null;
  countryCode: string;
  vitola: string | null;
  lengthMm: number | null;
  ringGauge: number | null;
  strength: number | null;
  wrapper: string | null;
  avgSmokeMinutes: number | null;
  imageUrl: string | null;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  brand: CigarBrandDetail;
  ratingAvg: number;
  ratingCount: number;
  ratingDistribution: Record<number, number>;
  recentReviews: CigarReviewSummary[];
}

export interface SuggestCigarPayload {
  name: string;
  line?: string;
  brandId?: string;
  brandName?: string;
  countryCode: string;
  vitola?: string;
  ringGauge?: number;
  lengthMm?: number;
  wrapper?: string;
  avgSmokeMinutes?: number;
  imageUrl?: string;
}

// --- Mídia ------------------------------------------------------------------

// SUPOSIÇÃO: acrescentamos a pasta `recognition` (fotos de anilha enviadas
// para IA) ao enum de pastas aceitas por `POST /media/presign`. Se o backend
// validar `folder` com uma lista fechada, ele precisa aceitar este valor
// novo — sinalizar para o agente de backend de mídia se divergir.
export type MediaFolder = 'avatars' | 'posts' | 'recognition' | 'support';

export interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

export interface PostMediaItem {
  objectKey?: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

// --- Reviews / posts ---------------------------------------------------------
//
// SUPOSIÇÃO (endpoint de posts/reviews ainda em construção por outro agente
// no momento desta implementação): assumimos que `POST /posts` aceita um
// campo opcional `review` com os dados da avaliação embutidos, usando os
// MESMOS nomes de campo do model Prisma `Review` (perceivedStrength,
// smokeMinutes, draw, burn, pairedWith) para maximizar a chance de bater com
// o que o backend realmente espera. Se o backend preferir dois posts
// separados (POST /reviews depois POST /posts com `reviewId`), esta função
// precisará ser ajustada.
export interface CreateReviewEmbedded {
  cigarId: string;
  rating: number; // 1..5, passos de 0.5
  perceivedStrength: number; // 1..5
  smokeMinutes?: number;
  draw?: number;
  burn?: number;
  pairedWith?: string;
  flavorNotes: string[];
}

export interface CreatePostPayload {
  body: string | null;
  visibility: PostVisibility;
  cigarId?: string;
  media?: PostMediaItem[];
  review?: CreateReviewEmbedded;
}

// SUPOSIÇÃO: `PostSummary` (@charuto/shared) não tem campo de nota — como o
// feed precisa exibir "a nota, se for review" (seção 7.2), assumimos que o
// backend embute um resumo da review no post quando ela existe.
export interface PostSummaryExt extends PostSummary {
  review?: { id: string; rating: number } | null;
}

export interface PostComment {
  id: string;
  body: string;
  createdAt: string;
  author: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
}

// --- Notificações -------------------------------------------------------------

export type NotificationType =
  | 'FOLLOW_REQUEST'
  | 'FOLLOW_ACCEPTED'
  | 'LIKE'
  | 'COMMENT'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'TRIAL_ENDING'
  | 'TRIAL_EXPIRED'
  | 'SHOP_MESSAGE'
  | 'INVITE_ACCEPTED';

// GET /notifications — confirmado contra o model Prisma `Notification`
// (apps/api/src/notifications), mas o endpoint de listagem em si (incluindo
// se ele já expande `actor`) ainda estava em construção; assumimos que ele
// devolve `actor` expandido (não só `actorId`).
export interface NotificationItem {
  id: string;
  type: NotificationType;
  actor: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl'> | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export type NotificationsPage = CursorPage<NotificationItem>;

// --- Follows -------------------------------------------------------------
//
// GET /users/:id/followers e /following já existem no backend (FollowsService)
// mas hoje devolvem um array cru de linhas `Follow` com o usuário completo do
// Prisma aninhado em `follower`/`followee` (não paginado, não mapeado para
// `PublicUser`). Normalizamos essa resposta defensivamente em
// `use-profile.ts` para o caso de o formato mudar para `CursorPage<PublicUser>`
// antes de esta tela ir para produção.
export interface FollowEdgeRaw {
  follower?: Record<string, unknown>;
  followee?: Record<string, unknown>;
  [key: string]: unknown;
}

// --- Reconhecimento por foto (seção 5.7) -------------------------------------
//
// Contrato final reconciliado com `apps/api/src/recognition/**`
// (`RecognitionCandidate`/`VitolaOption`/`RecognitionScanResult`).

export interface RecognitionMatch {
  cigarId: string;
  cigarName: string;
  brandName: string;
  line: string | null;
  vitola: string | null;
  imageUrl: string | null;
  confidencePercent: number; // 0..100
}

// Cada opção de bitola JÁ é um `cigarId` específico do catálogo (mesma marca
// e linha, vitola diferente) — escolher uma opção equivale a escolher o
// charuto certo direto, sem campo `vitola` solto para enviar no confirm.
export interface RecognitionVitolaOption {
  cigarId: string;
  vitola: string | null;
}

// POST /recognition/scan — body: { objectKey: string } (objectKey vem do
// presign de mídia, pasta "recognition").
export interface RecognitionScanPayload {
  objectKey: string;
}

export interface RecognitionScanResponse {
  matchId: string | null;
  imageHash: string;
  cropUrl: string | null;
  matches: RecognitionMatch[];
  requiresVitolaDisambiguation: boolean;
  vitolaOptions: RecognitionVitolaOption[];
  fallbackToManualSearch: boolean;
}

// POST /recognition/:matchId/confirm — body: { cigarId } (ou `null` quando
// nenhum candidato bateu e o usuário segue para busca manual).
export interface RecognitionConfirmPayload {
  cigarId: string | null;
}

export interface RecognitionConfirmResponse {
  matchId: string;
  cigarId: string | null;
  confirmed: boolean;
}

// --- Estatísticas do paladar (seção 5.8 / stats) -----------------------------
//
// Contrato final reconciliado com `apps/api/src/stats/stats.service.ts`.

export interface TopFlavorNoteStat {
  id: string;
  name: string;
  count: number;
}

export interface CountryTriedStat {
  countryCode: string;
  count: number;
}

export interface MonthlyReviewStat {
  month: string; // "yyyy-MM"
  count: number;
  avgRating: number;
}

// GET /stats/taste-profile
export interface TasteProfileResponse {
  avgStrength: number | null; // 1..5, média de TODAS as avaliações (não só 12 meses)
  avgStrengthNormalized: number | null; // 0..1, pronto para BipolarScaleBar
  topFlavorNotes: TopFlavorNoteStat[];
  countriesTried: CountryTriedStat[];
  reviewsPerMonth: MonthlyReviewStat[]; // sempre os últimos 12 meses, com count:0 nos vazios
  computedAt: string;
}

// GET /stats/history — paginação por cursor. `historyLimitedToDays` vem
// `null` para quem tem REVIEW_HISTORY_FULL, ou o corte (90) para quem não
// tem — o dado nunca é apagado, só a listagem é filtrada no backend.
export interface ReviewHistoryItem {
  id: string;
  cigarId: string;
  cigar: {
    id: string;
    name: string;
    line: string | null;
    brand: { id: string; name: string };
    countryCode: string;
    vitola: string | null;
  };
  postId: string | null;
  rating: number;
  perceivedStrength: number;
  smokeMinutes: number | null;
  draw: number | null;
  burn: number | null;
  body: string | null;
  pairedWith: string | null;
  flavorNotes: { id: string; name: string }[];
  reviewDate: string;
  createdAt: string;
}

export interface ReviewHistoryPage {
  items: ReviewHistoryItem[];
  nextCursor: string | null;
  historyLimitedToDays: number | null;
}

// GET /stats/compare?cigarIds=id1,id2,...
export interface CompareCigarStats {
  id: string;
  name: string;
  line: string | null;
  brand: { id: string; name: string };
  countryCode: string;
  vitola: string | null;
  lengthMm: number | null;
  ringGauge: number | null;
  strength: number | null;
  wrapper: string | null;
  avgSmokeMinutes: number | null;
  imageUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  ratingDistribution: Record<number, number>;
  community: {
    reviewCount: number;
    avgPerceivedStrength: number | null; // 1..5
    avgPerceivedStrengthNormalized: number | null; // 0..1
    avgDraw: number | null; // 1..5
    avgBurn: number | null; // 1..5
  };
}

export interface CompareResponse {
  cigars: CompareCigarStats[];
}

// GET /stats/export?format=csv|pdf — devolve o ARQUIVO CRU no corpo
// (text/csv ou text/html), não um JSON com URL — ver `getStatsExportRequest`
// em `use-stats.ts`, que monta a requisição autenticada de download direto.
