import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '../theme';
import { ThemedText } from './ThemedText';
import { PrimaryButton } from './PrimaryButton';

interface FeatureLockedStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}

/**
 * Paywall contextual (nunca um bloqueio abrupto de navegação): explica o
 * benefício do recurso premium e oferece um caminho claro até a assinatura.
 * Usado por todas as telas protegidas por `FeatureKey` desta fase
 * (reconhecimento por foto, estatísticas do paladar, comparação).
 */
export function FeatureLockedState({ icon = 'lock-closed', title, message }: FeatureLockedStateProps) {
  return (
    <View style={styles.wrapper}>
      <Ionicons name={icon} size={40} color={theme.colors.gold} />
      <ThemedText variant="title" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText variant="body" color="textSecondary" style={styles.message}>
        {message}
      </ThemedText>
      <PrimaryButton
        title="Ver planos premium"
        onPress={() => router.push('/settings/paywall')}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl },
  title: { marginTop: theme.spacing.md, textAlign: 'center' },
  message: { marginTop: theme.spacing.sm, textAlign: 'center' },
  button: { marginTop: theme.spacing.lg, alignSelf: 'stretch' },
});
