import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyShop } from '../api/shops';
import { checkoutShopPlan } from '../api/billing';
import { LoadingState, ErrorState } from '../components/PageState';

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  TRIAL: { label: 'Período de teste', color: 'var(--color-gold)' },
  ACTIVE: { label: 'Ativo', color: 'var(--color-positive)' },
  CANCELED: { label: 'Cancelado', color: 'var(--color-alert)' },
};

export function SubscriptionPage() {
  const query = useQuery({ queryKey: ['shop', 'me'], queryFn: getMyShop });
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function handleCheckout() {
    setCheckoutError(null);
    setLoadingCheckout(true);
    try {
      const session = await checkoutShopPlan('card');
      window.location.href = session.url;
    } catch {
      setCheckoutError('Não foi possível iniciar o checkout agora. Tente novamente em instantes.');
      setLoadingCheckout(false);
    }
  }

  if (query.isLoading) return <LoadingState label="Carregando assinatura…" />;
  if (query.isError || !query.data) return <ErrorState message="Não foi possível carregar a assinatura." />;

  const planInfo = PLAN_LABELS[query.data.plan] ?? { label: query.data.plan, color: 'var(--color-text-secondary)' };

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>Assinatura</h1>

      <div className="card">
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginBottom: 8 }}>Plano PJ — Charutaria</p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: planInfo.color, marginBottom: 20 }}>
          {planInfo.label}
        </p>

        {query.data.plan !== 'ACTIVE' && (
          <>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Assine o plano mensal para manter sua charutaria em destaque, com selo de verificada e todos os
              recursos do painel liberados.
            </p>
            <button className="btn btn-primary" onClick={handleCheckout} disabled={loadingCheckout}>
              {loadingCheckout ? 'Abrindo checkout…' : 'Assinar plano mensal'}
            </button>
            {checkoutError && (
              <p style={{ color: 'var(--color-alert)', fontSize: 13, marginTop: 12 }}>{checkoutError}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
