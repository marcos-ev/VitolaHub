interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

// Cartão de indicador simples, reutilizado no painel para leads, tempo médio
// de resposta, taxa de resposta, nota média etc.
export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 200 }}>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--color-gold)' }}>{value}</p>
      {hint && <p style={{ color: 'var(--color-text-tertiary)', fontSize: 12, marginTop: 6 }}>{hint}</p>}
    </div>
  );
}
