import { useEffect } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ThemedText } from './ThemedText';
import { theme } from '../theme';

interface StarRatingProps {
  rating: number; // 0..5, passos de 0.5
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
  /** Mostra o valor numérico (ex.: "4.5") ao lado das estrelas — usado nas telas de avaliação interativa. */
  showValue?: boolean;
}

export function StarRating({ rating, onChange, size = 32, readOnly = false, showValue = false }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];
  const isInteractive = !readOnly && !!onChange;
  const pulse = useSharedValue(1);
  const valueOpacity = useSharedValue(rating > 0 ? 1 : 0);

  useEffect(() => {
    if (!isInteractive) return;
    pulse.value = withSequence(withSpring(1.22, { damping: 6, stiffness: 260 }), withSpring(1, { damping: 8 }));
    valueOpacity.value = withTiming(rating > 0 ? 1 : 0, { duration: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rating]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const valueStyle = useAnimatedStyle(() => ({ opacity: valueOpacity.value, transform: [{ scale: 0.85 + valueOpacity.value * 0.15 }] }));

  const handlePress = (starIndex: number, event: GestureResponderEvent) => {
    if (!onChange) return;
    const x = event.nativeEvent.locationX;
    const value = x < size / 2 ? starIndex - 0.5 : starIndex;
    if (isInteractive) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onChange(value);
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.row, isInteractive && rowStyle]}>
        {stars.map((n) => {
          const filled = rating >= n;
          const half = !filled && rating >= n - 0.5;
          const iconName = filled ? 'star' : half ? 'star-half' : 'star-outline';
          return (
            <Pressable
              key={n}
              disabled={readOnly || !onChange}
              onPress={(event) => handlePress(n, event)}
              hitSlop={8}
              style={styles.star}
            >
              <Ionicons name={iconName} size={size} color={theme.colors.gold} />
            </Pressable>
          );
        })}
      </Animated.View>
      {showValue ? (
        <Animated.View style={[styles.valueBadge, valueStyle]}>
          <ThemedText variant="body" color="background" style={styles.valueText}>
            {rating > 0 ? rating.toFixed(1) : '—'}
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { paddingHorizontal: 2 },
  valueBadge: {
    marginLeft: theme.spacing.sm,
    backgroundColor: theme.colors.gold,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    minWidth: 40,
    alignItems: 'center',
  },
  valueText: { fontFamily: theme.fonts.bodySemiBold, fontSize: 13 },
});
