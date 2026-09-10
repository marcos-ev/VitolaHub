interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
}

// Gráfico de barras minimalista em SVG puro — evita puxar uma lib de
// gráficos pesada para um painel que precisa ser leve. Suficiente para as
// visualizações de leads/avaliações por período pedidas na spec.
export function BarChart({ data, height = 160 }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 100 / data.length;

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 24);
          return (
            <rect
              key={d.label}
              x={i * barWidth + barWidth * 0.15}
              y={height - 24 - barHeight}
              width={barWidth * 0.7}
              height={barHeight}
              rx={2}
              fill="var(--color-gold)"
            />
          );
        })}
      </svg>
      <div style={{ display: 'flex', marginTop: 8 }}>
        {data.map((d) => (
          <div
            key={d.label}
            style={{
              width: `${barWidth}%`,
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--color-text-tertiary)',
            }}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
