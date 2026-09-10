import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { theme } from '../theme';
import { ThemedText } from './ThemedText';

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.wrapper}>
      <ActivityIndicator color={theme.colors.gold} size="large" />
      {label ? (
        <ThemedText variant="caption" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg },
  label: { marginTop: theme.spacing.sm },
});
