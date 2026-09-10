import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ThemedText } from './ThemedText';
import { theme } from '../theme';

interface ScaleSelectorProps {
  value: number | null;
  onChange: (value: number) => void;
  max?: number;
  /** Rótulos descritivos abaixo do slider, ex.: ["Suave", "Intensa"]. */
  endLabels?: [string, string];
}

const THUMB_SIZE = 26;

// Slider fluido (inspirado nos seletores de sabor/intensidade de apps de
// vinho): trilho com preenchimento dourado animado e "thumb" que desliza com
// spring até a posição escolhida, em vez de botões numéricos estáticos.
export function ScaleSelector({ value, onChange, max = 5, endLabels }: ScaleSelectorProps) {
  const values = Array.from({ length: max }, (_, i) => i + 1);
  const [trackWidth, setTrackWidth] = useState(0);
  const position = useSharedValue(0);
  const fillWidth = useSharedValue(0);
  const thumbOpacity = useSharedValue(value ? 1 : 0);

  const usableWidth = Math.max(trackWidth - THUMB_SIZE, 1);

  useEffect(() => {
    if (!trackWidth) return;
    const ratio = value ? (value - 1) / (max - 1 || 1) : 0;
    position.value = withSpring(ratio * usableWidth, { damping: 16, stiffness: 180 });
    fillWidth.value = withSpring(ratio * usableWidth, { damping: 16, stiffness: 180 });
    thumbOpacity.value = withTiming(value ? 1 : 0, { duration: 150 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, trackWidth, max]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value }],
    opacity: thumbOpacity.value,
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: fillWidth.value }));

  const handleLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);

  const handleSelect = (n: number) => {
    if (n !== value) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onChange(n);
  };

  return (
    <View>
      <View style={styles.trackWrapper} onLayout={handleLayout}>
        <View style={styles.track} />
        <Animated.View style={[styles.trackFill, fillStyle]} />
        <Animated.View style={[styles.thumb, thumbStyle]} />
        <View style={styles.tapRow}>
          {values.map((n) => (
            <Pressable key={n} style={styles.tapSegment} onPress={() => handleSelect(n)} hitSlop={6} />
          ))}
        </View>
      </View>
      <View style={styles.ticksRow}>
        {values.map((n) => {
          const active = value === n;
          return (
            <ThemedText
              key={n}
              variant="caption"
              color={active ? 'gold' : 'textTertiary'}
              style={[styles.tick, active && styles.tickActive]}
            >
              {n}
            </ThemedText>
          );
        })}
      </View>
      {endLabels ? (
        <View style={styles.endLabelsRow}>
          <ThemedText variant="caption" color="textTertiary">
            {endLabels[0]}
          </ThemedText>
          <ThemedText variant="caption" color="textTertiary">
            {endLabels[1]}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trackWrapper: { height: THUMB_SIZE, justifyContent: 'center', marginTop: theme.spacing.xs },
  track: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.divider,
  },
  trackFill: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.gold,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: theme.colors.gold,
    borderWidth: 3,
    borderColor: theme.colors.background,
    ...theme.shadow.subtle,
  },
  tapRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', height: THUMB_SIZE },
  tapSegment: { flex: 1 },
  ticksRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.xs, paddingHorizontal: 4 },
  tick: { fontFamily: theme.fonts.bodyMedium, width: 20, textAlign: 'center' },
  tickActive: { fontFamily: theme.fonts.bodySemiBold },
  endLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
});
