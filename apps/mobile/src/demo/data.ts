import { AchievementProgress, CursorPage, EntitlementSnapshot, FeatureKey, PublicUser } from '@charuto/shared';
import { buildFeatureMap } from '@charuto/shared';
import { NotificationItem, PostComment, PostSummaryExt } from '../api/types';
import { ShopDetail, ShopListItem } from '../api/hooks/use-shops';
import { SupportTicket, SupportTicketDetail } from '../api/hooks/use-support';
import { DEMO_USER_ID, DEMO_USERNAME } from './tokens';

// --- Usuários ----------------------------------------------------------------

export const demoCurrentUser: PublicUser = {
  id: DEMO_USER_ID,
  username: DEMO_USERNAME,
  displayName: 'Marcos Demo',
  avatarUrl: null,
  bio: 'Apaixonado por charutos cubanos e nicaraguenses. Sempre em busca da próxima vitola.',
  city: 'São Paulo',
  state: 'SP',
  isPrivate: false,
  accountType: 'PF',
  followerCount: 128,
  followingCount: 45,
  friendCount: 12,
  isFollowedByMe: null,
  isFriendWithMe: false,
};

export const demoUsers: PublicUser[] = [
  demoCurrentUser,
  {
    id: 'user-002',
    username: 'charuteiro_sp',
    displayName: 'Ricardo Alves',
    avatarUrl: null,
    bio: 'Colecionador há 15 anos. Favoritos: Partagás e Padron.',
    city: 'São Paulo',
    state: 'SP',
    isPrivate: false,
    accountType: 'PF',
    followerCount: 892,
    followingCount: 210,
    friendCount: 34,
    isFollowedByMe: 'ACCEPTED',
    isFriendWithMe: true,
  },
  {
    id: 'user-003',
    username: 'humidor_rj',
    displayName: 'Ana Ferreira',
    avatarUrl: null,
    bio: 'Sommelier de charutos · Humidor com 200+ unidades',
    city: 'Rio de Janeiro',
    state: 'RJ',
    isPrivate: false,
    accountType: 'PF',
    followerCount: 1540,
    followingCount: 89,
    friendCount: 56,
    isFollowedByMe: 'ACCEPTED',
    isFriendWithMe: false,
  },
  {
    id: 'user-004',
    username: 'cigar_lounge_bh',
    displayName: 'Lounge Belo Horizonte',
    avatarUrl: null,
    bio: 'Perfil oficial do lounge parceiro Vitola Hub.',
    city: 'Belo Horizonte',
    state: 'MG',
    isPrivate: false,
    accountType: 'PJ',
    followerCount: 3200,
    followingCount: 12,
    friendCount: 0,
    isFollowedByMe: null,
    isFriendWithMe: false,
  },
];

function userById(id: string): PublicUser {
  return demoUsers.find((u) => u.id === id) ?? demoCurrentUser;
}

function userByUsername(username: string): PublicUser | undefined {
  return demoUsers.find((u) => u.username === username);
}

// --- Charutos ----------------------------------------------------------------

const demoCigars = [
  {
    id: 'cigar-001',
    name: 'Serie D No.4',
    line: 'Línea Clásica',
    brand: { id: 'brand-001', name: 'Partagás' },
    countryCode: 'CU',
    vitola: 'Robusto',
    ratingAvg: 4.6,
    ratingCount: 342,
    imageUrl: 'cigar://partagas-d4',
  },
  {
    id: 'cigar-002',
    name: '1964 Anniversary Series',
    line: '1964',
    brand: { id: 'brand-002', name: 'Padron' },
    countryCode: 'NI',
    vitola: 'Torpedo',
    ratingAvg: 4.8,
    ratingCount: 521,
    imageUrl: 'cigar://padron-1964',
  },
  {
    id: 'cigar-003',
    name: 'OpusX Perfecxion No.2',
    line: 'OpusX',
    brand: { id: 'brand-003', name: 'Arturo Fuente' },
    countryCode: 'DO',
    vitola: 'Churchill',
    ratingAvg: 4.9,
    ratingCount: 198,
    imageUrl: 'cigar://opusx',
  },
  {
    id: 'cigar-004',
    name: 'Liga Privada No.9',
    line: 'Liga Privada',
    brand: { id: 'brand-004', name: 'Drew Estate' },
    countryCode: 'NI',
    vitola: 'Robusto',
    ratingAvg: 4.5,
    ratingCount: 876,
    imageUrl: 'cigar://liga-privada',
  },
];

// --- Posts -------------------------------------------------------------------

export const demoPosts: PostSummaryExt[] = [
  {
    id: 'post-001',
    author: userById('user-002'),
    cigar: demoCigars[0],
    body: 'Partagás Serie D No.4 no robusto — cedro, café e pimenta preta no terço final. Essa é a vitola que eu volto sempre. O que vocês sentiram na última?',
    visibility: 'PUBLIC',
    likeCount: 47,
    commentCount: 3,
    media: [{ url: 'cigar://partagas-d4', thumbUrl: 'cigar://partagas-d4', width: 800, height: 800 }],
    likedByMe: false,
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    review: { id: 'rev-001', rating: 4.5 },
  },
  {
    id: 'post-002',
    author: userById('user-003'),
    cigar: demoCigars[1],
    body: 'Padron 1964 Anniversary Torpedo com um uísque ao lado. Maduro oleoso, queima reta, final longo. Vale registrar no umidor.',
    visibility: 'PUBLIC',
    likeCount: 112,
    commentCount: 3,
    media: [{ url: 'cigar://padron-1964', thumbUrl: 'cigar://padron-1964', width: 800, height: 800 }],
    likedByMe: true,
    createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    review: { id: 'rev-002', rating: 5 },
  },
  {
    id: 'post-003',
    author: demoCurrentUser,
    cigar: demoCigars[2],
    body: 'Primeira vez com Arturo Fuente OpusX Perfecxion No.2. Chocolate amargo, nozes e cinza firme no cinzeiro. Descobri por que tanto se fala dessa linha.',
    visibility: 'PUBLIC',
    likeCount: 34,
    commentCount: 2,
    media: [{ url: 'cigar://opusx', thumbUrl: 'cigar://opusx', width: 800, height: 800 }],
    likedByMe: false,
    createdAt: new Date(Date.now() - 24 * 3600_000).toISOString(),
    review: { id: 'rev-003', rating: 4.5 },
  },
  {
    id: 'post-004',
    author: userById('user-004'),
    cigar: demoCigars[3],
    body: 'Liga Privada No.9 no lounge hoje. Wrapper bem escuro, fumaça densa, terra e cacau. Quem já fumou essa vitola — forte demais ou na medida?',
    visibility: 'PUBLIC',
    likeCount: 89,
    commentCount: 2,
    media: [{ url: 'cigar://liga-privada', thumbUrl: 'cigar://liga-privada', width: 800, height: 800 }],
    likedByMe: false,
    createdAt: new Date(Date.now() - 48 * 3600_000).toISOString(),
    review: null,
  },
  {
    id: 'post-005',
    author: userById('user-002'),
    cigar: demoCigars[0],
    body: 'Duas vitolas no cedro: Serie D No.4 (robusto, 45 min) e um Churchill mais longo. Qual ritmo vocês escolhem pra noite — curto e picante ou lento e cremoso?',
    visibility: 'PUBLIC',
    likeCount: 28,
    commentCount: 2,
    media: [{ url: 'cigar://serie-d-vs', thumbUrl: 'cigar://serie-d-vs', width: 800, height: 800 }],
    likedByMe: false,
    createdAt: new Date(Date.now() - 72 * 3600_000).toISOString(),
    review: null,
  },
];

export const demoComments: Record<string, PostComment[]> = {
  'post-001': [
    {
      id: 'comment-001',
      body: 'Serie D No.4 é clássico. Cedro e pimenta na medida.',
      createdAt: new Date(Date.now() - 1 * 3600_000).toISOString(),
      author: { id: 'user-003', username: 'humidor_rj', displayName: 'Ana Ferreira', avatarUrl: null },
    },
    {
      id: 'comment-002',
      body: 'Qual whisky você usou na harmonização?',
      createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      author: demoCurrentUser,
    },
    {
      id: 'comment-001b',
      body: 'Lagavulin 16 fica perfeito com esse charuto.',
      createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      author: userById('user-004'),
    },
  ],
  'post-002': [
    {
      id: 'comment-003',
      body: 'Padron 1964 nunca decepciona. Construção impecável.',
      createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
      author: userById('user-002'),
    },
    {
      id: 'comment-003b',
      body: 'Esse Torpedo queima reto até o final. Top.',
      createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      author: demoCurrentUser,
    },
    {
      id: 'comment-003c',
      body: 'Vale cada centavo mesmo. Um dos melhores da Nicarágua.',
      createdAt: new Date(Date.now() - 90 * 60_000).toISOString(),
      author: userById('user-004'),
    },
  ],
  'post-003': [
    {
      id: 'comment-004',
      body: 'OpusX é outro nível. Chocolate amargo e nozes, exatamente.',
      createdAt: new Date(Date.now() - 10 * 3600_000).toISOString(),
      author: userById('user-002'),
    },
    {
      id: 'comment-005',
      body: 'Segura uns 20 min antes de acender. Vale a pena.',
      createdAt: new Date(Date.now() - 8 * 3600_000).toISOString(),
      author: userById('user-003'),
    },
  ],
  'post-004': [
    {
      id: 'comment-006',
      body: 'Liga Privada No.9 é pesada no começo e abre cacau no terço médio. Boa escolha.',
      createdAt: new Date(Date.now() - 20 * 3600_000).toISOString(),
      author: userById('user-002'),
    },
    {
      id: 'comment-007',
      body: 'No lounge a gente deixa descansar 15 min depois de cortar. Muda o empate.',
      createdAt: new Date(Date.now() - 18 * 3600_000).toISOString(),
      author: userById('user-004'),
    },
  ],
  'post-005': [
    {
      id: 'comment-008',
      body: 'O robusto resolve a noite. O Churchill pede tempo e café.',
      createdAt: new Date(Date.now() - 40 * 3600_000).toISOString(),
      author: userById('user-003'),
    },
    {
      id: 'comment-009',
      body: 'Fico com a D No.4 no dia a dia. Churchill eu deixo pro sábado.',
      createdAt: new Date(Date.now() - 36 * 3600_000).toISOString(),
      author: demoCurrentUser,
    },
  ],
};

// --- Notificações ------------------------------------------------------------

export const demoNotifications: NotificationItem[] = [
  {
    id: 'notif-001',
    type: 'LIKE',
    actor: userById('user-002'),
    entityType: 'POST',
    entityId: 'post-003',
    readAt: null,
    createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
  },
  {
    id: 'notif-002',
    type: 'COMMENT',
    actor: userById('user-003'),
    entityType: 'POST',
    entityId: 'post-003',
    readAt: null,
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  },
  {
    id: 'notif-003',
    type: 'FOLLOW_ACCEPTED',
    actor: userById('user-002'),
    entityType: 'USER',
    entityId: 'user-002',
    readAt: new Date(Date.now() - 24 * 3600_000).toISOString(),
    createdAt: new Date(Date.now() - 48 * 3600_000).toISOString(),
  },
  {
    id: 'notif-004',
    type: 'ACHIEVEMENT_UNLOCKED',
    actor: null,
    entityType: 'ACHIEVEMENT',
    entityId: 'first-review',
    readAt: new Date(Date.now() - 72 * 3600_000).toISOString(),
    createdAt: new Date(Date.now() - 96 * 3600_000).toISOString(),
  },
];

// --- Lojas -------------------------------------------------------------------

export const demoShops: ShopListItem[] = [
  {
    id: 'shop-001',
    tradeName: 'Charutaria Paulista',
    address: 'Rua Augusta, 1200 — Consolação, São Paulo',
    lat: -23.5534,
    lng: -46.6589,
    whatsapp: '5511999887766',
    instagram: '@charutariapaulista',
    isVerified: true,
    plan: 'PREMIUM',
    avgResponseSeconds: 1800,
    responseRate: 0.95,
    distanceKm: 2.3,
  },
  {
    id: 'shop-002',
    tradeName: 'Tabacaria do Centro',
    address: 'Av. Paulista, 900 — Bela Vista, São Paulo',
    lat: -23.564,
    lng: -46.652,
    whatsapp: '5511988776655',
    instagram: '@tabacariacentro',
    isVerified: true,
    plan: 'STANDARD',
    avgResponseSeconds: 3600,
    responseRate: 0.88,
    distanceKm: 4.1,
  },
  {
    id: 'shop-003',
    tradeName: 'Humidor Premium RJ',
    address: 'Rua Visconde de Pirajá, 550 — Ipanema, Rio de Janeiro',
    lat: -22.9838,
    lng: -43.2042,
    whatsapp: '5521999887766',
    instagram: '@humidorpremiumrj',
    isVerified: false,
    plan: 'STANDARD',
    avgResponseSeconds: 7200,
    responseRate: 0.75,
    distanceKm: 358,
  },
];

export function demoShopDetail(shopId: string): ShopDetail | null {
  const shop = demoShops.find((s) => s.id === shopId);
  if (!shop) return null;
  return {
    ...shop,
    cnpj: '12345678000199',
    hours: { 'seg-sex': '10:00–20:00', sab: '10:00–18:00', dom: 'Fechado' },
    ratingAvg: 4.7,
    ratingCount: 89,
    recentReviews: [
      {
        id: 'shop-rev-001',
        rating: 5,
        body: 'Atendimento excelente e humidor impecável.',
        user: { id: 'user-002', username: 'charuteiro_sp', displayName: 'Ricardo Alves', avatarUrl: null },
        createdAt: new Date(Date.now() - 7 * 24 * 3600_000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 365 * 24 * 3600_000).toISOString(),
  };
}

// --- Suporte -----------------------------------------------------------------

export const demoSupportTickets: SupportTicket[] = [
  {
    id: 'ticket-001',
    code: 'SUP-2024-001',
    category: 'SUGGESTION',
    subject: 'Filtro por país de origem',
    message: 'Seria ótimo poder filtrar charutos por país no catálogo.',
    status: 'OPEN',
    attachmentUrls: [],
    helpful: null,
    createdAt: new Date(Date.now() - 3 * 24 * 3600_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
  },
];

export function demoSupportTicketDetail(ticketId: string): SupportTicketDetail | null {
  const ticket = demoSupportTickets.find((t) => t.id === ticketId);
  if (!ticket) return null;
  return {
    ...ticket,
    clientMeta: { appVersion: '0.1.0', osName: 'Android' },
    messages: [
      {
        id: 'msg-001',
        authorType: 'USER',
        authorLabel: 'Você',
        body: ticket.message,
        createdAt: ticket.createdAt,
      },
      {
        id: 'msg-002',
        authorType: 'STAFF',
        authorLabel: 'Suporte Vitola Hub',
        body: 'Obrigado pela sugestão! Já encaminhamos para o time de produto.',
        createdAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
      },
    ],
  };
}

// --- Entitlements & achievements ---------------------------------------------

export const demoEntitlements: EntitlementSnapshot = {
  isPremium: true,
  isTrial: true,
  trialEndsAt: new Date(Date.now() + 5 * 24 * 3600_000).toISOString(),
  premiumUntil: null,
  features: buildFeatureMap(true),
  resolvedAt: new Date().toISOString(),
};

export const demoAchievements: AchievementProgress[] = [
  {
    code: 'first-review',
    name: 'Primeira Review',
    description: 'Publique sua primeira avaliação de charuto.',
    icon: 'star',
    tier: 1,
    unlockedAt: new Date(Date.now() - 30 * 24 * 3600_000).toISOString(),
    progress: 1,
    current: 1,
    target: 1,
  },
  {
    code: 'humidor-10',
    name: 'Humidor Iniciante',
    description: 'Adicione 10 charutos ao seu humidor.',
    icon: 'archive',
    tier: 1,
    unlockedAt: null,
    progress: 0.6,
    current: 6,
    target: 10,
  },
  {
    code: 'explorer',
    name: 'Explorador',
    description: 'Experimente charutos de 5 países diferentes.',
    icon: 'globe',
    tier: 2,
    unlockedAt: null,
    progress: 0.4,
    current: 2,
    target: 5,
  },
];

// --- Umidor ------------------------------------------------------------------

export const demoHumidorItems: {
  id: string;
  cigarId: string;
  quantity: number;
  acquiredAt: string;
  note: string | null;
  pricePaid: number | null;
  readOnly: boolean;
  cigar: {
    id: string;
    name: string;
    line: string | null;
    countryCode: string;
    vitola: string | null;
    imageUrl: string | null;
    ratingAvg: number;
    ratingCount: number;
    brand: { id: string; name: string; countryCode: string };
  };
}[] = [
  {
    id: 'humidor-001',
    cigarId: demoCigars[0].id,
    quantity: 3,
    acquiredAt: new Date(Date.now() - 20 * 24 * 3600_000).toISOString(),
    note: 'Caixa da Casa del Habano',
    pricePaid: 89.9,
    readOnly: false,
    cigar: {
      id: demoCigars[0].id,
      name: demoCigars[0].name,
      line: demoCigars[0].line,
      countryCode: demoCigars[0].countryCode,
      vitola: demoCigars[0].vitola,
      imageUrl: demoCigars[0].imageUrl,
      ratingAvg: demoCigars[0].ratingAvg,
      ratingCount: demoCigars[0].ratingCount,
      brand: { id: demoCigars[0].brand.id, name: demoCigars[0].brand.name, countryCode: demoCigars[0].countryCode },
    },
  },
];

// --- Chat --------------------------------------------------------------------

export const demoConversations: {
  id: string;
  shopId: string;
  userId: string;
  status: string;
  lastMessageAt: string;
  shop: { id: string; tradeName: string };
  lastMessage: { body: string; createdAt: string; senderType: 'USER' | 'SHOP' };
  unreadCount: number;
}[] = [
  {
    id: 'conv-001',
    shopId: 'shop-001',
    userId: DEMO_USER_ID,
    status: 'OPEN',
    lastMessageAt: new Date(Date.now() - 3600_000).toISOString(),
    shop: { id: 'shop-001', tradeName: 'Charutaria Paulista' },
    lastMessage: {
      body: 'Temos Partagás Serie D em estoque. Quer que reserve?',
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
      senderType: 'SHOP',
    },
    unreadCount: 1,
  },
];

export const demoChatMessages: Record<
  string,
  {
    id: string;
    conversationId: string;
    senderType: 'USER' | 'SHOP';
    senderId: string;
    body: string;
    readAt: string | null;
    createdAt: string;
  }[]
> = {
  'conv-001': [
    {
      id: 'cmsg-001',
      conversationId: 'conv-001',
      senderType: 'USER',
      senderId: DEMO_USER_ID,
      body: 'Boa tarde! Vocês têm Serie D No.4?',
      readAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    },
    {
      id: 'cmsg-002',
      conversationId: 'conv-001',
      senderType: 'SHOP',
      senderId: 'shop-001',
      body: 'Temos Partagás Serie D em estoque. Quer que reserve?',
      readAt: null,
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
    },
  ],
};

// --- Helpers -----------------------------------------------------------------

export function paginate<T>(items: T[], cursor: string | null, pageSize = 10): CursorPage<T> {
  const start = cursor ? parseInt(cursor, 10) : 0;
  const slice = items.slice(start, start + pageSize);
  const next = start + pageSize < items.length ? String(start + pageSize) : null;
  return { items: slice, nextCursor: next };
}

export function findPost(postId: string): PostSummaryExt | undefined {
  return demoPosts.find((p) => p.id === postId);
}

export function postsByAuthor(authorId: string): PostSummaryExt[] {
  return demoPosts.filter((p) => p.author.id === authorId);
}

export { userByUsername, userById, demoCigars };
