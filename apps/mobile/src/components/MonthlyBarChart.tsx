import { StyleSheet, View } from 'react-native';
import { theme } from '../theme';
import { ThemedText } from './ThemedText';

export interface MonthlyBarChartDatum {
  month: string; // "yyyy-MM"
  count: number;
}

const MONTH_ABBREVIATIONS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatMonthLabel(month: string): string {
  const parts = month.split('-');
  const monthIndex = Number(parts[1]) - 1;
  return MONTH_ABBREVIATIONS[monthIndex] ?? month;
}

const CHART_HEIGHT = 96;

/**
 * Gráfico de barras verticais simples (evolução mensal, últimos 12 meses),
 * desenhado à mão com `View`s — sem lib de gráfico, mantendo a estética
 * sóbria da spec (sem eixo sofisticado, só rótulo de mês por baixo).
 */
export function MonthlyBarChart({ data }: { data: MonthlyBarChartDatum[] }) {
  const maxCount = Math.max(1, ...data.map((item) => item.count));

  return (
    <View style={styles.wrapper}>
      <View style={styles.barsRow}>
        {data.map((item) => {
          const height = item.count === 0 ? 2 : Math.max(4, (item.count / maxCount) * CHART_HEIGHT);
          return (
            <View key={item.month} style={styles.barColumn}>
              <ThemedText variant="caption" style={styles.countLabel}>
                {item.count > 0 ? item.count : ''}
              </ThemedText>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height }]} />
              </View>
              <ThemedText variant="caption" style={styles.monthLabel}>
                {formatMonthLabel(item.month)}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingTop: theme.spacing.sm },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  barColumn: { flex: 1, alignItems: 'center' },
  countLabel: { fontSize: 10, marginBottom: theme.spacing.xs },
  barTrack: { height: CHART_HEIGHT, justifyContent: 'flex-end' },
  bar: { width: 8, borderRadius: 4, backgroundColor: theme.colors.gold },
  monthLabel: { marginTop: theme.spacing.xs, fontSize: 10 },
});
