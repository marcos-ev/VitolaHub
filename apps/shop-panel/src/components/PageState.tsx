export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return <p style={{ color: 'var(--color-text-secondary)', padding: 24 }}>{label}</p>;
}

export function ErrorState({ message = 'Não foi possível carregar os dados.' }: { message?: string }) {
  return (
    <div
      className="card"
      style={{ borderColor: 'var(--color-alert)', color: 'var(--color-alert)' }}
    >
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p style={{ color: 'var(--color-text-tertiary)', padding: 24, textAlign: 'center' }}>{message}</p>;
}
