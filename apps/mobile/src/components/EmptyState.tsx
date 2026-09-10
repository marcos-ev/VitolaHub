import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { ThemedText } from './ThemedText';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  message: string;
}

export function EmptyState({ icon = 'file-tray-outline', message }: EmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      <Ionicons name={icon} size={32} color={theme.colors.textTertiary} />
      <ThemedText variant="caption" style={styles.message}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl },
  message: { marginTop: theme.spacing.sm, textAlign: 'center' },
});
