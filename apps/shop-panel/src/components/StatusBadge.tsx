const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  OPEN: { bg: 'rgba(201, 162, 74, 0.16)', fg: 'var(--color-gold)', label: 'Aberto' },
  RESPONDED: { bg: 'rgba(46, 125, 79, 0.18)', fg: 'var(--color-positive)', label: 'Respondido' },
  CLOSED: { bg: 'rgba(110, 95, 75, 0.25)', fg: 'var(--color-text-secondary)', label: 'Encerrado' },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    bg: 'rgba(110, 95, 75, 0.25)',
    fg: 'var(--color-text-secondary)',
    label: status,
  };

  return (
    <span className="badge" style={{ background: style.bg, color: style.fg }}>
      {style.label}
    </span>
  );
}
