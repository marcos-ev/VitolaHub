import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { ThemedText } from './ThemedText';
import { PrimaryButton } from './PrimaryButton';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Não foi possível carregar o conteúdo.', onRetry }: ErrorStateProps) {
  return (
    <View style={styles.wrapper}>
      <Ionicons name="alert-circle-outline" size={36} color={theme.colors.alert} />
      <ThemedText variant="body" style={styles.message}>
        {message}
      </ThemedText>
      {onRetry ? (
        <PrimaryButton title="Tentar novamente" onPress={onRetry} variant="outline" style={styles.retryButton} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg },
  message: { marginTop: theme.spacing.sm, textAlign: 'center', color: theme.colors.textSecondary },
  retryButton: { marginTop: theme.spacing.md },
});
