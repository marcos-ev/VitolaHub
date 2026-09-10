import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyShop } from '../api/shops';
import { getShopReviews } from '../api/reviews';
import { LoadingState, ErrorState, EmptyState } from '../components/PageState';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function ReviewsPage() {
  const [cursor, setCursor] = useState<string | null>(null);
  const shopQuery = useQuery({ queryKey: ['shop', 'me'], queryFn: getMyShop });

  const reviewsQuery = useQuery({
    queryKey: ['reviews', shopQuery.data?.id, cursor],
    queryFn: () => getShopReviews(shopQuery.data!.id, cursor),
    enabled: !!shopQuery.data?.id,
  });

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Avaliações recebidas</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>
        Avaliações deixadas por clientes que visitaram o umidor
      </p>

      <div className="card" style={{ padding: 0 }}>
        {shopQuery.isLoading || reviewsQuery.isLoading ? (
          <LoadingState />
        ) : shopQuery.isError || reviewsQuery.isError ? (
          <ErrorState message="Não foi possível carregar as avaliações." />
        ) : reviewsQuery.data && reviewsQuery.data.items.length > 0 ? (
          <>
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Nota</th>
                  <th>Comentário</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {reviewsQuery.data.items.map((review) => (
                  <tr key={review.id}>
                    <td>{review.user.displayName}</td>
                    <td style={{ color: 'var(--color-gold)' }}>★ {review.rating.toFixed(1)}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{review.body ?? '—'}</td>
                    <td>{formatDate(review.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16 }}>
              <button
                className="btn btn-secondary"
                disabled={!reviewsQuery.data.nextCursor}
                onClick={() => setCursor(reviewsQuery.data!.nextCursor)}
              >
                Próxima página
              </button>
            </div>
          </>
        ) : (
          <EmptyState message="Nenhuma avaliação recebida ainda." />
        )}
      </div>
    </div>
  );
}
