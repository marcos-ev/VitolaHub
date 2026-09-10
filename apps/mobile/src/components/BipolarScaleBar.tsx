import { StyleSheet, View } from 'react-native';
import { theme } from '../theme';
import { ThemedText } from './ThemedText';

export interface BipolarMarker {
  value: number; // 0..1, posição relativa entre as duas pontas
  label?: string;
  color?: string;
}

interface BipolarScaleBarProps {
  leftLabel: string;
  rightLabel: string;
  markers: BipolarMarker[];
}

const MARKER_SIZE = 14;

/**
 * Barra de característica bipolar (moodboard: "Macio↔Ácido" do Vivino,
 * adaptado ao charuto). Duas labels nas pontas e uma trilha horizontal com
 * um ou mais marcadores de posição — nunca cor semafórica, só tons já
 * presentes no tema (dourado em variações de intensidade/opacidade).
 */
export function BipolarScaleBar({ leftLabel, rightLabel, markers }: BipolarScaleBarProps) {
  return (
    <View>
      <View style={styles.labelsRow}>
        <ThemedText variant="caption">{leftLabel}</ThemedText>
        <ThemedText variant="caption">{rightLabel}</ThemedText>
      </View>
      <View style={styles.track}>
        {markers.map((marker, index) => {
          const clamped = Math.min(1, Math.max(0, marker.value));
          return (
            <View
              key={index}
              style={[
                styles.marker,
                {
                  left: `${clamped * 100}%`,
                  marginLeft: -MARKER_SIZE / 2,
                  backgroundColor: marker.color ?? theme.colors.gold,
                },
              ]}
            />
          );
        })}
      </View>
      {markers.some((marker) => !!marker.label) ? (
        <View style={styles.legendRow}>
          {markers.map((marker, index) =>
            marker.label ? (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: marker.color ?? theme.colors.gold }]} />
                <ThemedText variant="caption" numberOfLines={1} style={styles.legendLabel}>
                  {marker.label}
                </ThemedText>
              </View>
            ) : null,
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xs },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.surfaceElevated,
    position: 'relative',
    justifyContent: 'center',
  },
  marker: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: theme.spacing.md, marginBottom: theme.spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: theme.spacing.xs },
  legendLabel: { maxWidth: 96 },
});
