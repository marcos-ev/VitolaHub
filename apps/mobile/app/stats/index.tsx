import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { FeatureKey } from '@charuto/shared';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { EmptyState } from '../../src/components/EmptyState';
import { Chip } from '../../src/components/Chip';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { BipolarScaleBar } from '../../src/components/BipolarScaleBar';
import { MonthlyBarChart } from '../../src/components/MonthlyBarChart';
import { FeatureLockedState } from '../../src/components/FeatureLockedState';
import { theme } from '../../src/theme';
import { useEntitlements, hasFeature } from '../../src/api/hooks/use-entitlements';
import { useTasteProfile } from '../../src/api/hooks/use-stats';
import { getErrorMessage } from '../../src/lib/error-message';
import { countryCodeToFlag } from '../../src/lib/country';

export default function TasteStatsScreen() {
  const entitlements = useEntitlements();

  if (entitlements.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Estatísticas do paladar" />
        <LoadingState label="Verificando seu plano..." />
      </Screen>
    );
  }

  if (entitlements.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Estatísticas do paladar" />
        <ErrorState message={getErrorMessage(entitlements.error)} onRetry={() => entitlements.refetch()} />
      </Screen>
    );
  }

  if (!hasFeature(entitlements.data, FeatureKey.TASTE_STATS)) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Estatísticas do paladar" />
        <FeatureLockedState
          icon="stats-chart"
          title="Conheça seu perfil de paladar"
          message="Veja sua força preferida, países mais fumados, notas de sabor recorrentes e sua evolução ao longo do tempo. Exclusivo para assinantes Premium."
        />
      </Screen>
    );
  }

  return <TasteStatsContent />;
}

function TasteStatsContent() {
  const tasteProfileQuery = useTasteProfile();

  if (tasteProfileQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Estatísticas do paladar" />
        <LoadingState label="Carregando estatísticas..." />
      </Screen>
    );
  }

  if (tasteProfileQuery.isError || !tasteProfileQuery.data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Estatísticas do paladar" />
        <ErrorState message={getErrorMessage(tasteProfileQuery.error)} onRetry={() => tasteProfileQuery.refetch()} />
      </Screen>
    );
  }

  const profile = tasteProfileQuery.data;
  const maxCountryCount = Math.max(1, ...profile.countriesTried.map((c) => c.count));

  // `avgStrength` (média de TODAS as avaliações, não só os últimos 12 meses)
  // só é `null` no backend quando o usuário não tem nenhuma avaliação ainda
  // — sinal mais preciso de "sem dados" do que somar `reviewsPerMonth`.
  if (profile.avgStrength === null) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Estatísticas do paladar" />
        <EmptyState
          icon="stats-chart-outline"
          message="Avalie alguns charutos para começarmos a montar o seu perfil de paladar."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Estatísticas do paladar" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <ThemedText variant="title" style={styles.sectionTitle}>
          Força percebida média
        </ThemedText>
        {profile.avgStrength != null && profile.avgStrengthNormalized != null ? (
          <View style={styles.section}>
            <BipolarScaleBar leftLabel="Suave" rightLabel="Forte" markers={[{ value: profile.avgStrengthNormalized }]} />
            <ThemedText variant="caption" style={styles.strengthValue}>
              Média: {profile.avgStrength.toFixed(1)} de 5
            </ThemedText>
          </View>
        ) : (
          <ThemedText variant="caption" style={styles.section}>
            Ainda não há dados suficientes.
          </ThemedText>
        )}

        <ThemedText variant="title" style={styles.sectionTitle}>
          Países mais fumados
        </ThemedText>
        {profile.countriesTried.length === 0 ? (
          <ThemedText variant="caption" style={styles.section}>
            Nenhum dado ainda.
          </ThemedText>
        ) : (
          <View style={styles.section}>
            {profile.countriesTried.map((country) => (
              <View key={country.countryCode} style={styles.countryRow}>
                <ThemedText variant="body" style={styles.countryFlag}>
                  {countryCodeToFlag(country.countryCode)}
                </ThemedText>
                <ThemedText variant="caption" style={styles.countryCode}>
                  {country.countryCode}
                </ThemedText>
                <View style={styles.countryBarTrack}>
                  <View
                    style={[styles.countryBarFill, { width: `${(country.count / maxCountryCount) * 100}%` }]}
                  />
                </View>
                <ThemedText variant="caption" style={styles.countryCount}>
                  {country.count}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        <ThemedText variant="title" style={styles.sectionTitle}>
          Notas de sabor mais frequentes
        </ThemedText>
        {profile.topFlavorNotes.length === 0 ? (
          <ThemedText variant="caption" style={styles.section}>
            Nenhum dado ainda.
          </ThemedText>
        ) : (
          <View style={[styles.chipsRow, styles.section]}>
            {profile.topFlavorNotes.map((note) => (
              <Chip key={note.id} label={`${note.name} (${note.count})`} selected onPress={() => undefined} />
            ))}
          </View>
        )}

        <ThemedText variant="title" style={styles.sectionTitle}>
          Evolução mensal
        </ThemedText>
        <View style={styles.section}>
          <MonthlyBarChart data={profile.reviewsPerMonth} />
        </View>

        <PrimaryButton
          title="Ver histórico completo"
          onPress={() => router.push('/stats/history')}
          variant="outline"
          style={styles.historyButton}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: theme.spacing.xl },
  sectionTitle: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  section: { marginBottom: theme.spacing.xs },
  strengthValue: { marginTop: theme.spacing.sm },
  countryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  countryFlag: { width: 24 },
  countryCode: { width: 32 },
  countryBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceElevated,
    marginHorizontal: theme.spacing.sm,
    overflow: 'hidden',
  },
  countryBarFill: { height: '100%', backgroundColor: theme.colors.gold, borderRadius: 3 },
  countryCount: { width: 28, textAlign: 'right' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  historyButton: { marginTop: theme.spacing.xl },
});
