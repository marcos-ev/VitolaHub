import type { CursorPage } from '@charuto/shared';
import { apiFetch } from './client';

export type LeadStatus = 'OPEN' | 'RESPONDED' | 'CLOSED';

export interface LeadUser {
  displayName: string;
  avatarUrl: string | null;
}

// SUPOSIÇÃO: endpoint de listagem de leads ainda não confirmado (módulo
// `shops/` em construção). Assumindo `GET /api/v1/shops/me/leads` filtrável
// por intervalo de datas, com o mesmo formato de `model ShopLead` do schema
// (shopId, userId, conversationId, status, createdAt) + paginação por
// cursor no padrão do restante do app.
export interface Lead {
  id: string;
  userId: string;
  conversationId: string | null;
  status: LeadStatus;
  createdAt: string;
  user: LeadUser;
}

export interface GetLeadsParams {
  sinceDays?: 7 | 30 | 90;
  cursor?: string | null;
}

export function getLeads(params: GetLeadsParams = {}): Promise<CursorPage<Lead>> {
  const query = new URLSearchParams();
  if (params.sinceDays) query.set('sinceDays', String(params.sinceDays));
  if (params.cursor) query.set('cursor', params.cursor);
  const qs = query.toString();
  return apiFetch<CursorPage<Lead>>(`/shops/me/leads${qs ? `?${qs}` : ''}`);
}
