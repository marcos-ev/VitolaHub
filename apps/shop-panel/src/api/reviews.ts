import type { CursorPage } from '@charuto/shared';
import { apiFetch } from './client';

export interface ShopReviewAuthor {
  displayName: string;
  avatarUrl: string | null;
}

// SUPOSIÇÃO: contrato de `GET /api/v1/shops/:id/reviews` ainda não
// confirmado (módulo `shops/` em construção). Formato assumido a partir do
// `model ShopReview` do schema + do padrão `CursorPage<T>` já usado em
// outras listagens paginadas do app (ex. feed, avaliações de charuto).
export interface ShopReview {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  user: ShopReviewAuthor;
}

export function getShopReviews(shopId: string, cursor?: string | null): Promise<CursorPage<ShopReview>> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return apiFetch<CursorPage<ShopReview>>(`/shops/${shopId}/reviews${query ? `?${query}` : ''}`);
}
