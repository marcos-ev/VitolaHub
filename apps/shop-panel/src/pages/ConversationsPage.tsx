import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getConversations } from '../api/chat';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../components/PageState';

// Polling simples em vez de WebSocket nesta primeira versão do painel — o
// app mobile já tem infra de socket.io para o chat em tempo real; replicar
// isso aqui teria um custo de implementação alto e não é a prioridade deste
// primeiro entregável. Simplificação aceitável, documentada no resumo final.
const POLL_INTERVAL_MS = 15_000;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function ConversationsPage() {
  const query = useQuery({
    queryKey: ['conversations'],
    queryFn: () => getConversations(),
    refetchInterval: POLL_INTERVAL_MS,
  });

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Conversas</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>
        Atualiza automaticamente a cada {POLL_INTERVAL_MS / 1000}s
      </p>

      <div className="card" style={{ padding: 0 }}>
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState message="Não foi possível carregar as conversas." />
        ) : query.data && query.data.items.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Status</th>
                <th>Última mensagem</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((conv) => (
                <tr key={conv.id}>
                  <td>{conv.user.displayName}</td>
                  <td>
                    <StatusBadge status={conv.status} />
                  </td>
                  <td>{formatDate(conv.lastMessageAt)}</td>
                  <td>
                    <Link to={`/conversas/${conv.id}`}>Abrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Nenhuma conversa ainda." />
        )}
      </div>
    </div>
  );
}
