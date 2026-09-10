import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getLeads } from '../api/leads';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../components/PageState';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function LeadsPage() {
  const [sinceDays, setSinceDays] = useState<7 | 30 | 90>(30);
  const [cursor, setCursor] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['leads', 'page', sinceDays, cursor],
    queryFn: () => getLeads({ sinceDays, cursor }),
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>Leads</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Conversas iniciadas por clientes que viraram lead rastreado
          </p>
        </div>
        <DateRangeFilter
          value={sinceDays}
          onChange={(v) => {
            setSinceDays(v);
            setCursor(null);
          }}
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState message="Não foi possível carregar os leads." />
        ) : query.data && query.data.items.length > 0 ? (
          <>
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.user.displayName}</td>
                    <td>
                      <StatusBadge status={lead.status} />
                    </td>
                    <td>{formatDate(lead.createdAt)}</td>
                    <td>
                      {lead.conversationId ? (
                        <Link to={`/conversas/${lead.conversationId}`}>Ver conversa</Link>
                      ) : (
                        <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16 }}>
              <button
                className="btn btn-secondary"
                disabled={!query.data.nextCursor}
                onClick={() => setCursor(query.data!.nextCursor)}
              >
                Próxima página
              </button>
            </div>
          </>
        ) : (
          <EmptyState message="Nenhum lead no período selecionado." />
        )}
      </div>
    </div>
  );
}
