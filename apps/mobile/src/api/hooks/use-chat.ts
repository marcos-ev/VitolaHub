import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { CursorPage } from '@charuto/shared';
import { apiFetch, API_BASE_URL } from '../client';
import { useAuthStore } from '../../state/auth-store';

// Deriva a base do WebSocket a partir da mesma URL da API REST, removendo o
// prefixo de versão (`/api/v1`) — suposição documentada: o gateway de chat
// roda na raiz do mesmo servidor Nest, não sob o prefixo versionado do REST.
const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

export interface ChatShopSummary {
  id: string;
  tradeName: string;
}

export interface ChatConversationSummary {
  id: string;
  shopId: string;
  userId: string;
  status: string;
  lastMessageAt: string | null;
  shop: ChatShopSummary | null;
  lastMessage: { body: string; createdAt: string; senderType: 'USER' | 'SHOP' } | null;
  unreadCount: number;
}

interface RawConversation {
  [key: string]: unknown;
}

function normalizeConversations(raw: unknown): ChatConversationSummary[] {
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown[] }).items)
      ? (raw as { items: unknown[] }).items
      : [];

  return rows.map((row) => {
    const item = row as RawConversation;
    return {
      id: String(item.id ?? ''),
      shopId: String(item.shopId ?? ''),
      userId: String(item.userId ?? ''),
      status: String(item.status ?? 'OPEN'),
      lastMessageAt: (item.lastMessageAt as string | null) ?? null,
      shop: (item.shop as ChatShopSummary | undefined) ?? null,
      lastMessage: (item.lastMessage as ChatConversationSummary['lastMessage']) ?? null,
      unreadCount: Number(item.unreadCount ?? 0),
    } satisfies ChatConversationSummary;
  });
}

// GET /chat/conversations — SUPOSIÇÃO (módulo em construção por outro agente
// no momento desta implementação: só os DTOs e `ChatEventsService` existiam
// no backend, sem controller/gateway ainda). Assumimos que devolve uma lista
// (ou `{ items }`) de conversas com `shop` expandido e um resumo da última
// mensagem, normalizando defensivamente como em `use-profile.ts`. Se o
// endpoint ainda não existir (404), a tela mostra estado vazio.
export function useConversationsQuery() {
  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: async () => normalizeConversations(await apiFetch<unknown>('/chat/conversations')),
    retry: false,
  });
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: 'USER' | 'SHOP';
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

// GET /chat/conversations/:id/messages — SUPOSIÇÃO: paginação por cursor
// (`CursorPage<ChatMessage>`), igual ao resto da API. `refetchInterval` é o
// fallback de tempo real por polling pedido explicitamente na especificação,
// ligado/desligado pelo chamador conforme o estado da conexão WebSocket.
export function useMessagesQuery(conversationId: string | undefined, pollingEnabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['chat', 'messages', conversationId],
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const params = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : '';
      return apiFetch<CursorPage<ChatMessage>>(`/chat/conversations/${conversationId}/messages${params}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!conversationId,
    refetchInterval: pollingEnabled ? 4000 : false,
    retry: false,
  });
}

// POST /chat/conversations/:id/messages — { body }
export function useSendMessageMutation(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<ChatMessage>(`/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { body },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] }),
  });
}

// POST /chat/conversations/:id/read
export function useMarkConversationReadMutation(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/chat/conversations/${conversationId}/read`, { method: 'POST' }).catch(() => undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] }),
  });
}

// POST /chat/conversations — { shopId } -> abre (ou reaproveita, já que o
// schema tem `@@unique([shopId, userId])`) a conversa do usuário com a loja.
export function useOpenConversationMutation() {
  return useMutation({
    mutationFn: (shopId: string) =>
      apiFetch<{ id: string }>('/chat/conversations', { method: 'POST', body: { shopId } }),
  });
}

// POST /chat/conversations/:id/report — { reason }. Endpoint sendo criado por
// outro agente no momento desta implementação: se ainda não existir (404), a
// tela chamadora trata o erro graciosamente em vez de travar.
export function useReportConversationMutation(conversationId: string | undefined) {
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch(`/chat/conversations/${conversationId}/report`, { method: 'POST', body: { reason } }),
  });
}

/**
 * Tempo real via `socket.io-client`, autenticado pelo access token atual.
 * Reconciliado com `ChatGateway` real (`apps/api/src/chat/chat.gateway.ts`):
 *
 *  - `@WebSocketGateway({ path: '/chat' })` configura um PATH de transporte
 *    customizado (a URL do handshake HTTP/WS, tipo `/socket.io/`), não um
 *    NAMESPACE — por isso conectamos em `SOCKET_BASE_URL` com `path: '/chat'`,
 *    nunca em `${SOCKET_BASE_URL}/chat` (que seria um namespace `/chat` no
 *    path padrão, e nunca bateria com o servidor).
 *  - `ChatGateway.extractToken` só lê o token de `handshake.headers.authorization`
 *    ou `handshake.query.token` — nunca de `handshake.auth` (payload `auth` do
 *    socket.io-client vai para `handshake.auth`, não para `query`). Como
 *    `extraHeaders` não é confiável em WebSocket puro no React Native, mandamos
 *    o token via `query`, que é o único canal que o gateway realmente lê.
 *
 * O servidor entra a conexão na room `conversation:${conversationId}` a
 * partir do evento `conversation:join` emitido pelo cliente, e emite
 * `message:new` para essa room. Se o socket não conectar, `connected`
 * continua `false` e quem chama este hook deve ligar o polling do React
 * Query como fallback (ver `useMessagesQuery`) — as duas estratégias ficam
 * ativas ao mesmo tempo por segurança, nunca só uma.
 */
export function useChatRealtime(conversationId: string | undefined, onMessage: (message: ChatMessage) => void) {
  const [connected, setConnected] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!conversationId || !accessToken) return undefined;

    const socket: Socket = io(SOCKET_BASE_URL, {
      path: '/chat',
      query: { token: accessToken },
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('conversation:join', { conversationId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('message:new', (message: ChatMessage) => {
      if (message.conversationId === conversationId) onMessageRef.current(message);
    });

    return () => {
      socket.disconnect();
    };
  }, [conversationId, accessToken]);

  return { connected };
}
