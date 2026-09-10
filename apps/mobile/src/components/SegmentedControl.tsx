import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable key={option.value} style={styles.item} onPress={() => onChange(option.value)}>
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
            <View style={[styles.indicator, active && styles.indicatorActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: theme.touchable.minHeight,
    paddingBottom: theme.spacing.sm,
  },
  label: { fontFamily: theme.fonts.bodyMedium, fontSize: 15, color: theme.colors.textSecondary },
  labelActive: { color: theme.colors.gold, fontFamily: theme.fonts.bodySemiBold },
  indicator: { height: 2, width: '60%', marginTop: theme.spacing.sm, borderRadius: 1, backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: theme.colors.gold },
});
