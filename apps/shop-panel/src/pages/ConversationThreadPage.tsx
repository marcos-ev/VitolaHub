import { FormEvent, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getMessages, sendMessage } from '../api/chat';
import { LoadingState, ErrorState, EmptyState } from '../components/PageState';

const POLL_INTERVAL_MS = 8_000;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function ConversationThreadPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');

  const query = useQuery({
    queryKey: ['messages', id],
    queryFn: () => getMessages(id!),
    enabled: !!id,
    refetchInterval: POLL_INTERVAL_MS,
  });

  const mutation = useMutation({
    mutationFn: (body: string) => sendMessage(id!, body),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['messages', id] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    mutation.mutate(draft.trim());
  }

  const messages = [...(query.data?.items ?? [])].reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/conversas" style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
          ← Voltar para conversas
        </Link>
        <h1 style={{ fontSize: 22, marginTop: 8 }}>Conversa</h1>
      </div>

      <div className="card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState message="Não foi possível carregar as mensagens." />
        ) : messages.length === 0 ? (
          <EmptyState message="Nenhuma mensagem ainda." />
        ) : (
          messages.map((msg) => {
            const fromShop = msg.senderType === 'SHOP';
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: fromShop ? 'flex-end' : 'flex-start',
                  maxWidth: '65%',
                  background: fromShop ? 'var(--color-gold)' : 'var(--color-surface-elevated)',
                  color: fromShop ? 'var(--color-background)' : 'var(--color-text-primary)',
                  borderRadius: 12,
                  padding: '10px 14px',
                }}
              >
                <p style={{ fontSize: 14 }}>{msg.body}</p>
                <p
                  style={{
                    fontSize: 11,
                    marginTop: 4,
                    color: fromShop ? 'rgba(20,16,11,0.7)' : 'var(--color-text-tertiary)',
                  }}
                >
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input
          style={{ flex: 1 }}
          placeholder="Escreva uma mensagem…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending || !draft.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
