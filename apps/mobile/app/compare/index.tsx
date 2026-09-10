import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CigarCover } from '../../src/components/CigarCover';
import { Stack } from 'expo-router';
import { FeatureKey } from '@charuto/shared';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { TextField } from '../../src/components/TextField';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { EmptyState } from '../../src/components/EmptyState';
import { StarRating } from '../../src/components/StarRating';
import { RatingDistributionBars } from '../../src/components/RatingDistributionBars';
import { BipolarScaleBar, BipolarMarker } from '../../src/components/BipolarScaleBar';
import { FeatureLockedState } from '../../src/components/FeatureLockedState';
import { theme } from '../../src/theme';
import { useEntitlements, hasFeature } from '../../src/api/hooks/use-entitlements';
import { useCigarSearch } from '../../src/api/hooks/use-catalog';
import { useCompareCigars } from '../../src/api/hooks/use-stats';
import { CigarSearchItem, CompareCigarStats } from '../../src/api/types';
import { getErrorMessage } from '../../src/lib/error-message';
import { countryCodeToFlag } from '../../src/lib/country';

const MAX_CIGARS = 4;
const MARKER_COLORS = [theme.colors.gold, theme.colors.goldMuted, theme.colors.textSecondary, theme.colors.textTertiary];

export default function CompareCigarsScreen() {
  const entitlements = useEntitlements();

  if (entitlements.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Comparar charutos" />
        <LoadingState label="Verificando seu plano..." />
      </Screen>
    );
  }

  if (entitlements.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Comparar charutos" />
        <ErrorState message={getErrorMessage(entitlements.error)} onRetry={() => entitlements.refetch()} />
      </Screen>
    );
  }

  if (!hasFeature(entitlements.data, FeatureKey.COMPARE_CIGARS)) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Comparar charutos" />
        <FeatureLockedState
          icon="git-compare"
          title="Compare charutos lado a lado"
          message="Veja ficha técnica, nota média e força, tiragem e queima percebidas pela comunidade, lado a lado. Exclusivo para assinantes Premium."
        />
      </Screen>
    );
  }

  return <CompareContent />;
}

function CompareContent() {
  const [selected, setSelected] = useState<CigarSearchItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const searchQuery = useCigarSearch(debouncedSearch);
  const selectedIds = useMemo(() => selected.map((c) => c.id), [selected]);
  const compareQuery = useCompareCigars(selectedIds);

  const addCigar = (cigar: CigarSearchItem) => {
    if (selected.some((c) => c.id === cigar.id) || selected.length >= MAX_CIGARS) return;
    setSelected((current) => [...current, cigar]);
    setSearchInput('');
  };

  const removeCigar = (cigarId: string) => {
    setSelected((current) => current.filter((c) => c.id !== cigarId));
  };

  const strengthMarkers = buildMarkers(compareQuery.data?.cigars, (c) => c.community.avgPerceivedStrength);
  const drawMarkers = buildMarkers(compareQuery.data?.cigars, (c) => c.community.avgDraw);
  const burnMarkers = buildMarkers(compareQuery.data?.cigars, (c) => c.community.avgBurn);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Comparar charutos" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {selected.length > 0 ? (
          <View style={styles.selectedRow}>
            {selected.map((cigar) => (
              <View key={cigar.id} style={styles.selectedChip}>
                <ThemedText variant="caption" numberOfLines={1} style={styles.selectedChipText}>
                  {cigar.name}
                </ThemedText>
                <Pressable onPress={() => removeCigar(cigar.id)} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.textSecondary} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {selected.length < MAX_CIGARS ? (
          <View>
            <TextField
              placeholder="Buscar charuto para comparar..."
              value={searchInput}
              onChangeText={setSearchInput}
              autoCapitalize="none"
            />
            {searchQuery.isLoading ? <LoadingState label="Buscando..." /> : null}
            {searchQuery.data?.items
              .filter((item) => !selected.some((c) => c.id === item.id))
              .map((item) => (
                <Pressable key={item.id} style={styles.searchResultRow} onPress={() => addCigar(item)}>
                  <ThemedText variant="body">{item.name}</ThemedText>
                  <ThemedText variant="caption">{item.brand.name}</ThemedText>
                </Pressable>
              ))}
          </View>
        ) : (
          <ThemedText variant="caption" style={styles.maxReachedHint}>
            Máximo de {MAX_CIGARS} charutos por comparação.
          </ThemedText>
        )}

        {selected.length < 2 ? (
          <EmptyState icon="git-compare-outline" message="Escolha ao menos 2 charutos para comparar." />
        ) : compareQuery.isLoading ? (
          <LoadingState label="Comparando..." />
        ) : compareQuery.isError ? (
          <ErrorState message={getErrorMessage(compareQuery.error)} onRetry={() => compareQuery.refetch()} />
        ) : compareQuery.data ? (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.columnsScroll}>
              {compareQuery.data.cigars.map((cigar) => (
                <View key={cigar.id} style={styles.column}>
                  <CigarCover url={cigar.imageUrl} brand={cigar.brand.name} name={cigar.name} style={styles.columnImage} />
                  <ThemedText variant="body" numberOfLines={2} style={styles.columnName}>
                    {cigar.name}
                  </ThemedText>
                  <ThemedText variant="caption" numberOfLines={1}>
                    {cigar.brand.name}
                  </ThemedText>
                  <ThemedText variant="caption" style={styles.columnMeta}>
                    {countryCodeToFlag(cigar.countryCode)} {cigar.vitola ?? '—'}
                  </ThemedText>
                  <ThemedText variant="caption" style={styles.columnMeta}>
                    {cigar.lengthMm && cigar.ringGauge ? `${cigar.lengthMm}mm · ${cigar.ringGauge} ring` : '—'}
                  </ThemedText>

                  <View style={styles.columnRatingRow}>
                    <ThemedText variant="title">{cigar.ratingAvg.toFixed(1)}</ThemedText>
                  </View>
                  <StarRating rating={cigar.ratingAvg} readOnly size={14} />
                  <ThemedText variant="caption" style={styles.columnMeta}>
                    {cigar.ratingCount} avaliações
                  </ThemedText>

                  <View style={styles.columnDistribution}>
                    <RatingDistributionBars distribution={cigar.ratingDistribution} />
                  </View>
                </View>
              ))}
            </ScrollView>

            <ThemedText variant="title" style={styles.sectionTitle}>
              Força percebida (comunidade)
            </ThemedText>
            {strengthMarkers.length > 0 ? (
              <BipolarScaleBar leftLabel="Suave" rightLabel="Forte" markers={strengthMarkers} />
            ) : (
              <ThemedText variant="caption">Sem dados suficientes.</ThemedText>
            )}

            <ThemedText variant="title" style={styles.sectionTitle}>
              Tiragem percebida (comunidade)
            </ThemedText>
            {drawMarkers.length > 0 ? (
              <BipolarScaleBar leftLabel="Apertada" rightLabel="Solta" markers={drawMarkers} />
            ) : (
              <ThemedText variant="caption">Sem dados suficientes.</ThemedText>
            )}

            <ThemedText variant="title" style={styles.sectionTitle}>
              Queima percebida (comunidade)
            </ThemedText>
            {burnMarkers.length > 0 ? (
              <BipolarScaleBar leftLabel="Irregular" rightLabel="Uniforme" markers={burnMarkers} />
            ) : (
              <ThemedText variant="caption">Sem dados suficientes.</ThemedText>
            )}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function buildMarkers(
  cigars: CompareCigarStats[] | undefined,
  pick: (cigar: CompareCigarStats) => number | null,
): BipolarMarker[] {
  const list = cigars ?? [];
  return list
    .map((cigar, index): BipolarMarker | null => {
      const raw = pick(cigar);
      if (raw == null) return null;
      return {
        value: (raw - 1) / 4,
        label: cigar.name,
        color: MARKER_COLORS[index % MARKER_COLORS.length],
      };
    })
    .filter((marker): marker is BipolarMarker => marker !== null);
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: theme.spacing.xl },
  selectedRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.sm },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    maxWidth: 160,
  },
  selectedChipText: { marginRight: theme.spacing.xs },
  searchResultRow: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  maxReachedHint: { marginBottom: theme.spacing.md },
  columnsScroll: { marginBottom: theme.spacing.lg },
  column: {
    width: 168,
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.divider,
  },
  columnImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceElevated,
    marginBottom: theme.spacing.sm,
  },
  columnImagePlaceholder: {},
  columnName: { minHeight: 36 },
  columnMeta: { marginTop: theme.spacing.xs },
  columnRatingRow: { marginTop: theme.spacing.sm },
  columnDistribution: { marginTop: theme.spacing.sm },
  sectionTitle: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
});
