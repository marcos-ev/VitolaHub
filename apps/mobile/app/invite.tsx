import { Alert, Share, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { ThemedText } from '../src/components/ThemedText';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { LoadingState } from '../src/components/LoadingState';
import { ErrorState } from '../src/components/ErrorState';
import { theme } from '../src/theme';
import { useMyInviteQuery } from '../src/api/hooks/use-invites';
import { getErrorMessage } from '../src/lib/error-message';

// Convites (seção 5.5). Compartilhamento nativo via `Share` do React Native
// (sem lib nova, como pedido) com o `deepLink` já pronto que o backend
// devolve (`vitolahub://convite/{codigo}`), tratado em `app/_layout.tsx` para
// pré-preencher o campo de código no cadastro.
export default function InviteScreen() {
  const inviteQuery = useMyInviteQuery();

  const handleShare = async () => {
    if (!inviteQuery.data) return;
    try {
      await Share.share({
        message: `Baixe o Vitola Hub e use meu código de convite ${inviteQuery.data.code}: ${inviteQuery.data.webFallbackUrl}`,
        url: inviteQuery.data.deepLink,
      });
    } catch (error) {
      Alert.alert('Erro ao compartilhar', getErrorMessage(error));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Convidar amigos" />

      {inviteQuery.isLoading ? (
        <LoadingState label="Carregando seu convite..." />
      ) : inviteQuery.isError || !inviteQuery.data ? (
        <ErrorState message={getErrorMessage(inviteQuery.error)} onRetry={() => inviteQuery.refetch()} />
      ) : (
        <View style={styles.content}>
          <Ionicons name="gift" size={40} color={theme.colors.gold} />
          <ThemedText variant="title" style={styles.title}>
            Convide seus amigos para o Vitola Hub
          </ThemedText>
          <ThemedText variant="body" color="textSecondary" style={styles.subtitle}>
            Compartilhe seu código e acompanhe quantas pessoas já entraram.
          </ThemedText>

          <View style={styles.codeCard}>
            <ThemedText variant="caption" color="textTertiary">
              Seu código
            </ThemedText>
            <ThemedText variant="display" style={styles.code}>
              {inviteQuery.data.code}
            </ThemedText>
          </View>

          <PrimaryButton
            title="Compartilhar convite"
            onPress={handleShare}
            icon={<Ionicons name="share-social-outline" size={18} color={theme.colors.background} />}
            style={styles.shareButton}
          />

          <View style={styles.acceptedRow}>
            <Ionicons name="people-outline" size={16} color={theme.colors.textSecondary} />
            <ThemedText variant="caption" style={styles.acceptedText}>
              {inviteQuery.data.acceptedCount === 1
                ? '1 amigo já entrou com seu convite'
                : `${inviteQuery.data.acceptedCount} amigos já entraram com seu convite`}
            </ThemedText>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', paddingTop: theme.spacing.xl },
  title: { marginTop: theme.spacing.md, textAlign: 'center' },
  subtitle: { marginTop: theme.spacing.sm, textAlign: 'center' },
  codeCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.xl,
    width: '100%',
  },
  code: { marginTop: theme.spacing.xs, letterSpacing: 2 },
  shareButton: { marginTop: theme.spacing.xl, width: '100%' },
  acceptedRow: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.lg },
  acceptedText: { marginLeft: theme.spacing.xs },
});
