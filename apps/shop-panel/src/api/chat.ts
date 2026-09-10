import type { CursorPage } from '@charuto/shared';
import { apiFetch } from './client';

export type ConversationStatus = 'OPEN' | 'CLOSED';

export interface ConversationParticipant {
  displayName: string;
  avatarUrl: string | null;
}

// SUPOSIÇÃO: contrato de `GET /api/v1/chat/conversations` ainda não
// confirmado (backend em construção em paralelo). Formato assumido a partir
// de `model Conversation` do schema (shopId, userId, lastMessageAt, status)
// + do padrão `CursorPage<T>` de paginação já usado no resto do app.
export interface Conversation {
  id: string;
  userId: string;
  lastMessageAt: string | null;
  status: ConversationStatus;
  user: ConversationParticipant;
}

export function getConversations(cursor?: string | null): Promise<CursorPage<Conversation>> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return apiFetch<CursorPage<Conversation>>(`/chat/conversations${query ? `?${query}` : ''}`);
}

export type MessageSenderType = 'USER' | 'SHOP';

// SUPOSIÇÃO: rota de histórico de mensagens de uma conversa e de envio de
// nova mensagem ainda não confirmadas. Assumindo o padrão REST mais óbvio
// (`GET`/`POST` em `/chat/conversations/:id/messages`), compatível com
// `model Message` do schema (senderType, senderId, body, createdAt).
export interface Message {
  id: string;
  senderType: MessageSenderType;
  senderId: string;
  body: string;
  createdAt: string;
}

export function getMessages(conversationId: string, cursor?: string | null): Promise<CursorPage<Message>> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return apiFetch<CursorPage<Message>>(`/chat/conversations/${conversationId}/messages${query ? `?${query}` : ''}`);
}

export function sendMessage(conversationId: string, body: string): Promise<Message> {
  return apiFetch<Message>(`/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: { body },
  });
}
