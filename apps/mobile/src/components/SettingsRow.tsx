import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { ThemedText } from './ThemedText';

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  onPress?: () => void;
  right?: ReactNode;
  destructive?: boolean;
}

export function SettingsRow({ icon, label, description, onPress, right, destructive }: SettingsRowProps) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <Ionicons name={icon} size={20} color={destructive ? theme.colors.alert : theme.colors.gold} />
      <View style={styles.texts}>
        <ThemedText variant="body" color={destructive ? 'alert' : 'textPrimary'}>
          {label}
        </ThemedText>
        {description ? (
          <ThemedText variant="caption" style={styles.description}>
            {description}
          </ThemedText>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  texts: { flex: 1, marginLeft: theme.spacing.md },
  description: { marginTop: 2 },
});
