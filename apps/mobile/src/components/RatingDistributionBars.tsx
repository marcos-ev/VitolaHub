import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { ThemedText } from './ThemedText';

interface RatingDistributionBarsProps {
  distribution: Record<number, number>;
}

export function RatingDistributionBars({ distribution }: RatingDistributionBarsProps) {
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0) || 1;

  return (
    <View>
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[star] ?? 0;
        const percent = Math.round((count / total) * 100);
        return (
          <View key={star} style={styles.row}>
            <View style={styles.starLabel}>
              <ThemedText variant="caption">{star}</ThemedText>
              <Ionicons name="star" size={12} color={theme.colors.gold} style={styles.starIcon} />
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${percent}%` }]} />
            </View>
            <ThemedText variant="caption" style={styles.percentLabel}>
              {percent}%
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xs },
  starLabel: { flexDirection: 'row', alignItems: 'center', width: 32 },
  starIcon: { marginLeft: 2 },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceElevated,
    marginHorizontal: theme.spacing.sm,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: theme.colors.gold, borderRadius: 3 },
  percentLabel: { width: 36, textAlign: 'right' },
});
