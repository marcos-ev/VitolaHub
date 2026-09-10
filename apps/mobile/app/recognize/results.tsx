import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CigarCover } from '../../src/components/CigarCover';
import { Stack, router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Chip } from '../../src/components/Chip';
import { EmptyState } from '../../src/components/EmptyState';
import { theme } from '../../src/theme';
import { useConfirmRecognitionMatch } from '../../src/api/hooks/use-recognition';
import { useRecognitionStore } from '../../src/state/recognition-store';
import { RecognitionMatch } from '../../src/api/types';
import { getErrorMessage } from '../../src/lib/error-message';

export default function RecognizeResultsScreen() {
  const lastScan = useRecognitionStore((s) => s.lastScan);
  const clearScan = useRecognitionStore((s) => s.clear);
  const confirmMatch = useConfirmRecognitionMatch();

  // Cada opção de bitola já É um `cigarId` específico (mesma marca/linha,
  // vitola diferente) — não existe um "selecionar vitola" separado de
  // "selecionar o charuto": escolher a opção já resolve os dois de uma vez.
  const needsVitolaStep = useMemo(
    () => !!lastScan?.requiresVitolaDisambiguation && (lastScan?.vitolaOptions.length ?? 0) > 0,
    [lastScan],
  );

  if (!lastScan) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Resultado" />
        <EmptyState icon="camera-outline" message="Nenhuma análise recente. Volte e tire uma nova foto da anilha." />
        <PrimaryButton title="Tirar foto" onPress={() => router.replace('/recognize')} style={styles.spacedButton} />
      </Screen>
    );
  }

  const matchId = lastScan.matchId;

  const handleConfirmCigarId = async (cigarId: string) => {
    if (!matchId) return;
    try {
      await confirmMatch.mutateAsync({ matchId, cigarId });
      clearScan();
      router.replace(`/review/new?cigarId=${cigarId}`);
    } catch (error) {
      Alert.alert('Erro ao confirmar', getErrorMessage(error));
    }
  };

  const handleManualSearch = () => {
    clearScan();
    router.replace('/review/new');
  };

  const showFallback =
    !needsVitolaStep && (lastScan.fallbackToManualSearch || lastScan.matches.length === 0 || !matchId);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Resultado da análise" />

      {needsVitolaStep ? (
        <View style={styles.stepWrapper}>
          <ThemedText variant="title" style={styles.stepTitle}>
            Qual é a bitola?
          </ThemedText>
          <ThemedText variant="body" color="textSecondary" style={styles.stepMessage}>
            Identificamos a marca, mas a foto não permite deduzir a bitola exata — escolha a certa abaixo.
          </ThemedText>
          <View style={styles.chipsRow}>
            {lastScan.vitolaOptions.map((option) => (
              <Chip
                key={option.cigarId}
                label={option.vitola ?? 'Padrão'}
                selected={false}
                onPress={() => handleConfirmCigarId(option.cigarId)}
              />
            ))}
          </View>
        </View>
      ) : showFallback ? (
        <View style={styles.stepWrapper}>
          <EmptyState
            icon="help-circle-outline"
            message="Não conseguimos identificar com certeza o charuto dessa foto."
          />
          <PrimaryButton title="Buscar manualmente" onPress={handleManualSearch} style={styles.spacedButton} />
          <PrimaryButton
            title="Tentar outra foto"
            onPress={() => {
              clearScan();
              router.replace('/recognize');
            }}
            variant="outline"
          />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <ThemedText variant="body" color="textSecondary" style={styles.instructions}>
            Toque no charuto correto para confirmar. Nenhuma avaliação é enviada automaticamente.
          </ThemedText>

          {lastScan.matches.map((match) => (
            <MatchCard
              key={match.cigarId}
              match={match}
              onPress={() => handleConfirmCigarId(match.cigarId)}
              disabled={confirmMatch.isPending}
            />
          ))}

          <PrimaryButton
            title="Não é nenhum desses"
            onPress={handleManualSearch}
            variant="ghost"
            style={styles.spacedButton}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

function MatchCard({
  match,
  onPress,
  disabled,
}: {
  match: RecognitionMatch;
  onPress: () => void;
  disabled: boolean;
}) {
  // Intensidade do dourado do chip de confiança varia com o percentual —
  // nunca a cor (sem semáforo vermelho/amarelo/verde), conforme moodboard.
  const confidenceOpacity = Math.max(0.45, Math.min(1, match.confidencePercent / 100));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <CigarCover url={match.imageUrl} name={match.cigarName} style={styles.cardImage} />

      <View style={styles.cardTexts}>
        <ThemedText variant="body" numberOfLines={1}>
          {match.cigarName}
        </ThemedText>
        <ThemedText variant="caption" numberOfLines={1}>
          {match.brandName}
        </ThemedText>
      </View>

      <View style={[styles.confidenceChip, { opacity: confidenceOpacity }]}>
        <ThemedText variant="caption" style={styles.confidenceText}>
          {match.confidencePercent}% de confiança
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: theme.spacing.xl },
  instructions: { marginBottom: theme.spacing.md },
  stepWrapper: { flex: 1, paddingTop: theme.spacing.md },
  stepTitle: { marginBottom: theme.spacing.sm },
  stepMessage: { marginBottom: theme.spacing.md },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  spacedButton: { marginTop: theme.spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.divider,
  },
  cardPressed: { opacity: 0.85 },
  cardImage: { width: 56, height: 56, borderRadius: theme.radii.sm, backgroundColor: theme.colors.surfaceElevated },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardTexts: { flex: 1, marginLeft: theme.spacing.md, marginRight: theme.spacing.sm },
  confidenceChip: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  confidenceText: { color: theme.colors.gold },
});
