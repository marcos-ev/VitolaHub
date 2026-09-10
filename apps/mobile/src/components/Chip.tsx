import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Desabilita o toque (usado em contextos apenas de leitura, ex.: estatísticas). */
  disabled?: boolean;
}

export function Chip({ label, selected, onPress, disabled = false }: ChipProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (selected) scale.value = withSpring(1.05, { damping: 8, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 10 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };

  return (
    <Pressable onPress={handlePress} disabled={disabled} hitSlop={6}>
      <Animated.View style={[styles.chip, selected && styles.chipSelected, animatedStyle]}>
        {selected ? (
          <View style={styles.checkIcon}>
            <Ionicons name="checkmark" size={12} color={theme.colors.background} />
          </View>
        ) : null}
        <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    backgroundColor: theme.colors.surfaceElevated,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  chipSelected: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
    ...theme.shadow.subtle,
  },
  checkIcon: { marginRight: 4 },
  text: { fontFamily: theme.fonts.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  textSelected: { color: theme.colors.background, fontFamily: theme.fonts.bodySemiBold },
});
