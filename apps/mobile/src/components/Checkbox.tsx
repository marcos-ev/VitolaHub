import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface CheckboxProps extends PropsWithChildren {
  checked: boolean;
  onToggle: () => void;
}

export function Checkbox({ checked, onToggle, children }: CheckboxProps) {
  return (
    <Pressable style={styles.row} onPress={onToggle} hitSlop={4}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Ionicons name="checkmark" size={14} color={theme.colors.background} /> : null}
      </View>
      <View style={styles.label}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },
  label: { flex: 1, marginLeft: theme.spacing.sm },
});
