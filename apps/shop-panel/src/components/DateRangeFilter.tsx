const OPTIONS: { value: 7 | 30 | 90; label: string }[] = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
];

interface DateRangeFilterProps {
  value: 7 | 30 | 90;
  onChange: (value: 7 | 30 | 90) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, background: 'var(--color-surface)', padding: 4, borderRadius: 10 }}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="btn"
          style={{
            padding: '6px 14px',
            fontSize: 13,
            background: value === opt.value ? 'var(--color-gold)' : 'transparent',
            color: value === opt.value ? 'var(--color-background)' : 'var(--color-text-secondary)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
