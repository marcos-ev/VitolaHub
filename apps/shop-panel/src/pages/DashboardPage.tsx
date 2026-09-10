import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyShop, sendMonthlyReportNow } from '../api/shops';
import { getLeads } from '../api/leads';
import { getShopReviews } from '../api/reviews';
import { fetchAllPages } from '../api/pagination';
import { StatCard } from '../components/StatCard';
import { BarChart } from '../components/BarChart';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { LoadingState, ErrorState } from '../components/PageState';

function formatSeconds(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = (minutes / 60).toFixed(1);
  return `${hours} h`;
}

function formatPercent(value: number | null): string {
  if (value == null) return '—';
  return `${value.toFixed(0)}%`;
}

// Agrupa leads por dia para o gráfico de barras (só os últimos 7 pontos, pra
// não poluir a visualização mesmo quando o filtro é de 90 dias).
function buildLeadsChartData(createdAtList: string[]): { label: string; value: number }[] {
  const byDay = new Map<string, number>();
  for (const createdAt of createdAtList) {
    const day = createdAt.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const days = [...byDay.keys()].sort().slice(-7);
  return days.map((day) => ({
    label: day.slice(8, 10) + '/' + day.slice(5, 7),
    value: byDay.get(day) ?? 0,
  }));
}

export function DashboardPage() {
  const [sinceDays, setSinceDays] = useState<7 | 30 | 90>(30);
  const [reportSent, setReportSent] = useState(false);

  const shopQuery = useQuery({ queryKey: ['shop', 'me'], queryFn: getMyShop });

  const leadsQuery = useQuery({
    queryKey: ['leads', sinceDays],
    queryFn: () => fetchAllPages((cursor) => getLeads({ sinceDays, cursor })),
  });

  const reviewsQuery = useQuery({
    queryKey: ['reviews', 'recent', shopQuery.data?.id],
    queryFn: () => getShopReviews(shopQuery.data!.id),
    enabled: !!shopQuery.data?.id,
  });

  if (shopQuery.isLoading) return <LoadingState label="Carregando painel…" />;
  if (shopQuery.isError || !shopQuery.data) {
    return <ErrorState message="Não foi possível carregar os dados da loja." />;
  }

  const shop = shopQuery.data;
  const leads = leadsQuery.data ?? [];
  const recentReviews = reviewsQuery.data?.items ?? [];
  const avgRating =
    recentReviews.length > 0
      ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length
      : null;

  async function handleSendReport() {
    try {
      await sendMonthlyReportNow();
      setReportSent(true);
    } catch {
      alert('Não foi possível enviar o relatório agora. Essa funcionalidade pode ainda não estar disponível no backend.');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>{shop.tradeName}</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>Visão geral do período</p>
        </div>
        <DateRangeFilter value={sinceDays} onChange={setSinceDays} />
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard
          label={`Leads (${sinceDays} dias)`}
          value={leadsQuery.isLoading ? '…' : String(leads.length)}
        />
        <StatCard
          label="Tempo médio de resposta"
          value={formatSeconds(shop.avgResponseSeconds)}
          hint="Últimos 30 dias"
        />
        <StatCard
          label="Taxa de resposta"
          value={formatPercent(shop.responseRate)}
          hint="Últimos 30 dias"
        />
        <StatCard
          label="Nota média"
          value={avgRating != null ? avgRating.toFixed(1) : '—'}
          hint={`${recentReviews.length} avaliação(ões) recente(s)`}
        />
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 2, minWidth: 320 }}>
          <h2 style={{ fontSize: 16, marginBottom: 16 }}>Leads por dia</h2>
          {leadsQuery.isLoading ? (
            <LoadingState />
          ) : leads.length === 0 ? (
            <p style={{ color: 'var(--color-text-tertiary)' }}>Nenhum lead no período selecionado.</p>
          ) : (
            <BarChart data={buildLeadsChartData(leads.map((l) => l.createdAt))} />
          )}
        </div>

        <div className="card" style={{ flex: 1, minWidth: 260 }}>
          <h2 style={{ fontSize: 16, marginBottom: 16 }}>Avaliações recentes</h2>
          {reviewsQuery.isLoading ? (
            <LoadingState />
          ) : recentReviews.length === 0 ? (
            <p style={{ color: 'var(--color-text-tertiary)' }}>Nenhuma avaliação ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recentReviews.slice(0, 5).map((review) => (
                <div key={review.id} style={{ borderBottom: '1px solid var(--color-divider)', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: 13 }}>{review.user.displayName}</strong>
                    <span style={{ color: 'var(--color-gold)', fontSize: 13 }}>★ {review.rating.toFixed(1)}</span>
                  </div>
                  {review.body && (
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 4 }}>{review.body}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 16 }}>Relatório mensal por e-mail</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 4 }}>
            O envio automático mensal é feito pelo backend. Use o botão abaixo só se quiser reenviar o relatório
            deste mês agora.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleSendReport} disabled={reportSent}>
          {reportSent ? 'Relatório enviado' : 'Enviar relatório agora'}
        </button>
      </div>
    </div>
  );
}
