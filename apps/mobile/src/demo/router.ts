import { PublicUser } from '@charuto/shared';
import { ApiError } from '../api/errors';
import { AuthSession } from '../api/types';
import {
  demoAchievements,
  demoComments,
  demoCurrentUser,
  demoEntitlements,
  demoNotifications,
  demoPosts,
  demoShopDetail,
  demoShops,
  demoSupportTicketDetail,
  demoSupportTickets,
  demoUsers,
  findPost,
  paginate,
  postsByAuthor,
  userByUsername,
  demoCigars,
  demoHumidorItems,
  demoConversations,
  demoChatMessages,
} from './data';
import { createDemoTokens, DEMO_USER_ID, DEMO_USERNAME } from './tokens';

interface DemoRequest {
  path: string;
  method: string;
  body?: unknown;
}

const LATENCY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePath(fullPath: string): { pathname: string; searchParams: URLSearchParams } {
  const qIndex = fullPath.indexOf('?');
  const pathname = qIndex >= 0 ? fullPath.slice(0, qIndex) : fullPath;
  const query = qIndex >= 0 ? fullPath.slice(qIndex + 1) : '';
  return { pathname, searchParams: new URLSearchParams(query) };
}

function ok<T>(data: T): T {
  return data;
}

function noContent(): undefined {
  return undefined;
}

/**
 * Roteador mock da API — cobre os endpoints usados nas abas principais
 * (feed, perfil, notificações, lojas, suporte, explore) e autenticação.
 */
export async function demoApiRouter<T>(request: DemoRequest): Promise<T> {
  await sleep(LATENCY_MS);

  const { path, method, body } = request;
  const { pathname, searchParams } = parsePath(path);
  const upperMethod = method.toUpperCase();

  // --- Auth ------------------------------------------------------------------
  if (pathname === '/auth/login' && upperMethod === 'POST') {
    return ok(createDemoTokens(DEMO_USER_ID, DEMO_USERNAME)) as T;
  }

  if (pathname === '/auth/register' && upperMethod === 'POST') {
    const payload = body as { username?: string } | undefined;
    const username = payload?.username?.trim() || DEMO_USERNAME;
    return ok(createDemoTokens(`demo-${username}`, username)) as T;
  }

  if (pathname === '/auth/logout' && upperMethod === 'POST') {
    return noContent() as T;
  }

  if (pathname === '/auth/refresh' && upperMethod === 'POST') {
    return ok(createDemoTokens(DEMO_USER_ID, DEMO_USERNAME)) as T;
  }

  // --- Feed ------------------------------------------------------------------
  if ((pathname === '/feed/for-you' || pathname === '/feed/following') && upperMethod === 'GET') {
    const items = pathname === '/feed/following'
      ? demoPosts.filter((p) => p.author.id !== DEMO_USER_ID)
      : demoPosts;
    return ok(paginate(items, searchParams.get('cursor'))) as T;
  }

  // --- Users -----------------------------------------------------------------
  if (pathname === '/users/me' && upperMethod === 'PATCH') {
    const patch = body as Partial<PublicUser>;
    Object.assign(demoCurrentUser, patch);
    return ok({ ...demoCurrentUser }) as T;
  }

  if (pathname === '/users/me' && upperMethod === 'DELETE') {
    return noContent() as T;
  }

  if (pathname === '/users/me/privacy' && upperMethod === 'PATCH') {
    const { isPrivate } = body as { isPrivate: boolean };
    demoCurrentUser.isPrivate = isPrivate;
    return ok({ ...demoCurrentUser }) as T;
  }

  if (pathname === '/users/me/follow-requests' && upperMethod === 'GET') {
    return ok([]) as T;
  }

  if (pathname === '/users/me/blocked' && upperMethod === 'GET') {
    return ok([]) as T;
  }

  if (pathname === '/users/suggested' && upperMethod === 'GET') {
    return ok(demoUsers.filter((u) => u.id !== DEMO_USER_ID).slice(0, 3)) as T;
  }

  if (pathname === '/users/search' && upperMethod === 'GET') {
    const q = (searchParams.get('q') ?? '').toLowerCase();
    const results = demoUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q),
    );
    return ok(results) as T;
  }

  const userMatch = pathname.match(/^\/users\/([^/]+)$/);
  if (userMatch && upperMethod === 'GET') {
    const username = decodeURIComponent(userMatch[1]);
    const user = userByUsername(username);
    if (!user) throw new ApiError(404, { message: 'Usuário não encontrado.' });
    return ok({ ...user }) as T;
  }

  const followersMatch = pathname.match(/^\/users\/([^/]+)\/followers$/);
  if (followersMatch && upperMethod === 'GET') {
    return ok(demoUsers.filter((u) => u.id !== followersMatch[1]).slice(0, 2)) as T;
  }

  const followingMatch = pathname.match(/^\/users\/([^/]+)\/following$/);
  if (followingMatch && upperMethod === 'GET') {
    return ok(demoUsers.filter((u) => u.id !== followingMatch[1]).slice(0, 2)) as T;
  }

  const followMatch = pathname.match(/^\/users\/([^/]+)\/follow$/);
  if (followMatch && (upperMethod === 'POST' || upperMethod === 'DELETE')) {
    const target = demoUsers.find((u) => u.id === followMatch[1]);
    if (target) {
      if (upperMethod === 'POST') {
        target.isFollowedByMe = target.isPrivate ? 'PENDING' : 'ACCEPTED';
        target.followerCount += 1;
      } else {
        target.isFollowedByMe = null;
        target.followerCount = Math.max(0, target.followerCount - 1);
      }
    }
    return noContent() as T;
  }

  const userActionMatch = pathname.match(/^\/users\/([^/]+)\/(accept|reject|block|unblock|report)$/);
  if (userActionMatch && upperMethod === 'POST') {
    return noContent() as T;
  }

  // --- Posts -----------------------------------------------------------------
  if (pathname === '/posts' && upperMethod === 'GET') {
    const authorId = searchParams.get('authorId');
    const items = authorId ? postsByAuthor(authorId) : demoPosts;
    return ok(paginate(items, searchParams.get('cursor'))) as T;
  }

  if (pathname === '/posts' && upperMethod === 'POST') {
    const payload = body as {
      body?: string | null;
      visibility?: 'PUBLIC' | 'FRIENDS';
      media?: { url: string; thumbUrl: string; width: number; height: number }[];
    };
    const newPost = {
      id: `post-${Date.now()}`,
      author: demoCurrentUser,
      cigar: null,
      body: payload?.body ?? null,
      visibility: payload?.visibility ?? 'PUBLIC',
      likeCount: 0,
      commentCount: 0,
      media: payload?.media ?? [],
      likedByMe: false,
      createdAt: new Date().toISOString(),
      review: null,
    };
    demoPosts.unshift(newPost);
    return ok(newPost) as T;
  }

  const postMatch = pathname.match(/^\/posts\/([^/]+)$/);
  if (postMatch && upperMethod === 'DELETE') {
    const index = demoPosts.findIndex((p) => p.id === postMatch[1]);
    if (index >= 0) demoPosts.splice(index, 1);
    return noContent() as T;
  }
  if (postMatch && upperMethod === 'GET') {
    const post = findPost(postMatch[1]);
    if (!post) throw new ApiError(404, { message: 'Post não encontrado.' });
    return ok({ ...post }) as T;
  }

  const likeMatch = pathname.match(/^\/posts\/([^/]+)\/like$/);
  if (likeMatch && (upperMethod === 'POST' || upperMethod === 'DELETE')) {
    const post = findPost(likeMatch[1]);
    if (post) {
      if (upperMethod === 'POST') {
        post.likedByMe = true;
        post.likeCount += 1;
      } else {
        post.likedByMe = false;
        post.likeCount = Math.max(0, post.likeCount - 1);
      }
    }
    return noContent() as T;
  }

  const reportPostMatch = pathname.match(/^\/posts\/([^/]+)\/report$/);
  if (reportPostMatch && upperMethod === 'POST') {
    return noContent() as T;
  }

  const commentsMatch = pathname.match(/^\/posts\/([^/]+)\/comments$/);
  if (commentsMatch) {
    const postId = commentsMatch[1];
    if (upperMethod === 'GET') {
      const comments = demoComments[postId] ?? [];
      return ok(paginate(comments, searchParams.get('cursor'))) as T;
    }
    if (upperMethod === 'POST') {
      const { body: commentBody } = body as { body: string };
      const comment = {
        id: `comment-${Date.now()}`,
        body: commentBody,
        createdAt: new Date().toISOString(),
        author: demoCurrentUser,
      };
      if (!demoComments[postId]) demoComments[postId] = [];
      demoComments[postId].unshift(comment);
      const post = findPost(postId);
      if (post) post.commentCount += 1;
      return ok(comment) as T;
    }
  }

  const deleteCommentMatch = pathname.match(/^\/posts\/([^/]+)\/comments\/([^/]+)$/);
  if (deleteCommentMatch && upperMethod === 'DELETE') {
    const [, postId, commentId] = deleteCommentMatch;
    const list = demoComments[postId] ?? [];
    demoComments[postId] = list.filter((c) => c.id !== commentId);
    const post = findPost(postId);
    if (post) post.commentCount = Math.max(0, post.commentCount - 1);
    return noContent() as T;
  }

  // --- Notifications ---------------------------------------------------------
  if (pathname === '/notifications' && upperMethod === 'GET') {
    return ok(paginate(demoNotifications, searchParams.get('cursor'))) as T;
  }

  const notifReadMatch = pathname.match(/^\/notifications\/([^/]+)\/read$/);
  if (notifReadMatch && upperMethod === 'POST') {
    const notif = demoNotifications.find((n) => n.id === notifReadMatch[1]);
    if (notif && !notif.readAt) notif.readAt = new Date().toISOString();
    return noContent() as T;
  }

  // --- Shops -----------------------------------------------------------------
  if (pathname === '/shops' && upperMethod === 'GET') {
    return ok(paginate(demoShops, searchParams.get('cursor'))) as T;
  }

  const shopMatch = pathname.match(/^\/shops\/([^/]+)$/);
  if (shopMatch && upperMethod === 'GET') {
    const detail = demoShopDetail(shopMatch[1]);
    if (!detail) throw new ApiError(404, { message: 'Loja não encontrada.' });
    return ok(detail) as T;
  }

  const shopReviewMatch = pathname.match(/^\/shops\/([^/]+)\/reviews$/);
  if (shopReviewMatch && upperMethod === 'POST') {
    return noContent() as T;
  }

  const shopReportMatch = pathname.match(/^\/shops\/([^/]+)\/report$/);
  if (shopReportMatch && upperMethod === 'POST') {
    return noContent() as T;
  }

  // --- Support ---------------------------------------------------------------
  if (pathname === '/support/tickets' && upperMethod === 'GET') {
    return ok([...demoSupportTickets]) as T;
  }

  if (pathname === '/support/tickets' && upperMethod === 'POST') {
    const payload = body as { category: string; subject: string; message: string };
    const ticket = {
      id: `ticket-${Date.now()}`,
      code: `SUP-${Date.now()}`,
      category: payload.category as (typeof demoSupportTickets)[0]['category'],
      subject: payload.subject,
      message: payload.message,
      status: 'OPEN' as const,
      attachmentUrls: [],
      helpful: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    demoSupportTickets.unshift(ticket);
    return ok({
      ...ticket,
      clientMeta: null,
      messages: [
        {
          id: `msg-${Date.now()}`,
          authorType: 'USER' as const,
          authorLabel: 'Você',
          body: payload.message,
          createdAt: ticket.createdAt,
        },
      ],
    }) as T;
  }

  const ticketMatch = pathname.match(/^\/support\/tickets\/([^/]+)$/);
  if (ticketMatch && upperMethod === 'GET') {
    const detail = demoSupportTicketDetail(ticketMatch[1]);
    if (!detail) throw new ApiError(404, { message: 'Chamado não encontrado.' });
    return ok(detail) as T;
  }

  const ticketMsgMatch = pathname.match(/^\/support\/tickets\/([^/]+)\/messages$/);
  if (ticketMsgMatch && upperMethod === 'POST') {
    const { body: msgBody } = body as { body: string };
    return ok({
      id: `msg-${Date.now()}`,
      authorType: 'USER' as const,
      authorLabel: 'Você',
      body: msgBody,
      createdAt: new Date().toISOString(),
    }) as T;
  }

  const ticketFeedbackMatch = pathname.match(/^\/support\/tickets\/([^/]+)\/feedback$/);
  if (ticketFeedbackMatch && upperMethod === 'PATCH') {
    const ticket = demoSupportTickets.find((t) => t.id === ticketFeedbackMatch[1]);
    if (ticket) ticket.helpful = (body as { helpful: boolean }).helpful;
    return ok(ticket ?? {}) as T;
  }

  // --- Entitlements / achievements / humidor ---------------------------------
  if (pathname === '/entitlements/me' && upperMethod === 'GET') {
    return ok({ ...demoEntitlements }) as T;
  }

  if (pathname === '/achievements/me' && upperMethod === 'GET') {
    return ok([...demoAchievements]) as T;
  }

  if (pathname === '/humidor/me' && upperMethod === 'GET') {
    const page = Number(searchParams.get('page') ?? 1);
    const pageSize = Number(searchParams.get('pageSize') ?? 20);
    const start = (page - 1) * pageSize;
    return ok({
      items: demoHumidorItems.slice(start, start + pageSize),
      total: demoHumidorItems.length,
      page,
      pageSize,
    }) as T;
  }

  if (pathname === '/humidor' && upperMethod === 'POST') {
    const payload = body as { cigarId: string; quantity?: number; note?: string; pricePaid?: number };
    const cigar = demoCigars.find((c) => c.id === payload.cigarId) ?? demoCigars[0];
    const item = {
      id: `humidor-${Date.now()}`,
      cigarId: cigar.id,
      quantity: payload.quantity ?? 1,
      acquiredAt: new Date().toISOString(),
      note: payload.note ?? null,
      pricePaid: payload.pricePaid ?? null,
      readOnly: false,
      cigar: {
        id: cigar.id,
        name: cigar.name,
        line: cigar.line,
        countryCode: cigar.countryCode,
        vitola: cigar.vitola,
        imageUrl: cigar.imageUrl,
        ratingAvg: cigar.ratingAvg,
        ratingCount: cigar.ratingCount,
        brand: { id: cigar.brand.id, name: cigar.brand.name, countryCode: cigar.countryCode },
      },
    };
    demoHumidorItems.unshift(item);
    return ok(item) as T;
  }

  const humidorItemMatch = pathname.match(/^\/humidor\/([^/]+)$/);
  if (humidorItemMatch && upperMethod === 'PATCH') {
    const item = demoHumidorItems.find((row) => row.id === humidorItemMatch[1]);
    if (!item) throw new ApiError(404, { message: 'Item não encontrado.' });
    Object.assign(item, body);
    return ok(item) as T;
  }
  if (humidorItemMatch && upperMethod === 'DELETE') {
    const index = demoHumidorItems.findIndex((row) => row.id === humidorItemMatch[1]);
    if (index >= 0) demoHumidorItems.splice(index, 1);
    return noContent() as T;
  }

  if (pathname === '/invites/me' && upperMethod === 'GET') {
    return ok({ code: 'DEMO2024', usesRemaining: 5, maxUses: 10 }) as T;
  }

  // --- Catalog (busca básica) ------------------------------------------------
  if (pathname.startsWith('/catalog/cigars/search') && upperMethod === 'GET') {
    const q = (searchParams.get('q') ?? '').toLowerCase();
    const filtered = demoCigars.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.brand.name.toLowerCase().includes(q) ||
        (c.line?.toLowerCase().includes(q) ?? false),
    );
    return ok(paginate(filtered, searchParams.get('cursor'))) as T;
  }

  const cigarMatch = pathname.match(/^\/catalog\/cigars\/([^/]+)$/);
  if (cigarMatch && upperMethod === 'GET') {
    const cigar = demoCigars.find((c) => c.id === cigarMatch[1]);
    if (!cigar) throw new ApiError(404, { message: 'Charuto não encontrado.' });
    return ok({
      ...cigar,
      lengthMm: 124,
      ringGauge: 50,
      strength: 4,
      wrapper: 'Habano',
      avgSmokeMinutes: 75,
      status: 'APPROVED',
      ratingDistribution: { 5: 120, 4: 80, 3: 30, 2: 8, 1: 4 },
      recentReviews: [],
    }) as T;
  }

  // --- Media presign (retorna URLs fake) ---------------------------------------
  if (pathname === '/media/presign' && upperMethod === 'POST') {
    const key = `demo/${Date.now()}.jpg`;
    return ok({
      uploadUrl: 'https://example.com/upload',
      publicUrl: `cigar://upload-${Date.now()}`,
      objectKey: key,
    }) as T;
  }

  // --- Stats (fallback vazio) ------------------------------------------------
  if (pathname === '/stats/taste-profile' && upperMethod === 'GET') {
    return ok({
      avgStrength: 3.8,
      avgStrengthNormalized: 0.7,
      topFlavorNotes: [
        { id: 'fn-1', name: 'Café', count: 12 },
        { id: 'fn-2', name: 'Cedro', count: 9 },
      ],
      countriesTried: [
        { countryCode: 'CU', count: 8 },
        { countryCode: 'NI', count: 5 },
      ],
      reviewsPerMonth: [],
      computedAt: new Date().toISOString(),
    }) as T;
  }

  if (pathname.startsWith('/stats/history') && upperMethod === 'GET') {
    return ok({
      items: demoPosts
        .filter((p) => p.review)
        .map((p) => ({
          id: p.review!.id,
          rating: p.review!.rating,
          createdAt: p.createdAt,
          cigar: p.cigar,
          postId: p.id,
        })),
      nextCursor: null,
      historyLimitedToDays: null,
    }) as T;
  }

  if (pathname.startsWith('/stats/compare') && upperMethod === 'GET') {
    const ids = (searchParams.get('cigarIds') ?? '').split(',').filter(Boolean);
    const cigars = ids.map((id) => demoCigars.find((c) => c.id === id)).filter(Boolean);
    return ok({ cigars, notes: [] }) as T;
  }

  if (pathname === '/chat/conversations' && upperMethod === 'GET') {
    return ok([...demoConversations]) as T;
  }

  if (pathname === '/chat/conversations' && upperMethod === 'POST') {
    const { shopId } = body as { shopId: string };
    const existing = demoConversations.find((c) => c.shopId === shopId);
    if (existing) return ok(existing) as T;
    const shop = demoShops.find((s) => s.id === shopId);
    const created = {
      id: `conv-${Date.now()}`,
      shopId,
      userId: DEMO_USER_ID,
      status: 'OPEN',
      lastMessageAt: new Date().toISOString(),
      shop: { id: shopId, tradeName: shop?.tradeName ?? 'Charutaria' },
      lastMessage: null as { body: string; createdAt: string; senderType: 'USER' | 'SHOP' } | null,
      unreadCount: 0,
    };
    demoConversations.unshift(created);
    demoChatMessages[created.id] = [];
    return ok(created) as T;
  }

  const chatMsgs = pathname.match(/^\/chat\/conversations\/([^/]+)\/messages$/);
  if (chatMsgs && upperMethod === 'GET') {
    return ok(paginate(demoChatMessages[chatMsgs[1]] ?? [], searchParams.get('cursor'))) as T;
  }
  if (chatMsgs && upperMethod === 'POST') {
    const conversationId = chatMsgs[1];
    const { body: text } = body as { body: string };
    const message = {
      id: `cmsg-${Date.now()}`,
      conversationId,
      senderType: 'USER' as const,
      senderId: DEMO_USER_ID,
      body: text,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    if (!demoChatMessages[conversationId]) demoChatMessages[conversationId] = [];
    demoChatMessages[conversationId].push(message);
    const conv = demoConversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.lastMessage = { body: text, createdAt: message.createdAt, senderType: 'USER' };
      conv.lastMessageAt = message.createdAt;
    }
    return ok(message) as T;
  }

  const chatRead = pathname.match(/^\/chat\/conversations\/([^/]+)\/read$/);
  if (chatRead && upperMethod === 'POST') {
    const conv = demoConversations.find((c) => c.id === chatRead[1]);
    if (conv) conv.unreadCount = 0;
    return noContent() as T;
  }

  const chatReport = pathname.match(/^\/chat\/conversations\/([^/]+)\/report$/);
  if (chatReport && upperMethod === 'POST') {
    return noContent() as T;
  }

  // --- Contact -----------------------------------------------------------------
  if (pathname === '/contact' && upperMethod === 'POST') {
    return ok({ ok: true }) as T;
  }

  // --- Recognition (mock básico) -----------------------------------------------
  if (pathname === '/recognition/scan' && upperMethod === 'POST') {
    return ok({
      matchId: 'match-demo-1',
      imageHash: 'demo-hash',
      cropUrl: null,
      matches: [
        {
          cigarId: demoCigars[0].id,
          cigarName: demoCigars[0].name,
          brandName: demoCigars[0].brand.name,
          line: demoCigars[0].line,
          vitola: demoCigars[0].vitola,
          imageUrl: null,
          confidencePercent: 87,
        },
      ],
      requiresVitolaDisambiguation: false,
      vitolaOptions: [],
      fallbackToManualSearch: false,
    }) as T;
  }

  const confirmMatch = pathname.match(/^\/recognition\/([^/]+)\/confirm$/);
  if (confirmMatch && upperMethod === 'POST') {
    return ok({
      matchId: confirmMatch[1],
      cigarId: demoCigars[0].id,
      confirmed: true,
    }) as T;
  }

  console.warn(`[demo] Endpoint não mockado: ${upperMethod} ${pathname}`);
  throw new ApiError(404, { message: `Endpoint demo não implementado: ${pathname}` });
}

/** Login rápido em modo demo — define tokens fake no store. */
export async function demoLogin(): Promise<AuthSession> {
  await sleep(LATENCY_MS);
  return createDemoTokens(DEMO_USER_ID, DEMO_USERNAME);
}

export { createDemoTokens };
