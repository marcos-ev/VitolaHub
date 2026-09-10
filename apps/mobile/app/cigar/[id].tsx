import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { CigarCover } from '../../src/components/CigarCover';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { StarRating } from '../../src/components/StarRating';
import { RatingDistributionBars } from '../../src/components/RatingDistributionBars';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Avatar } from '../../src/components/Avatar';
import { theme } from '../../src/theme';
import { useCigarDetail } from '../../src/api/hooks/use-catalog';
import { getErrorMessage } from '../../src/lib/error-message';
import { countryCodeToFlag } from '../../src/lib/country';

const STRENGTH_LABELS: Record<number, string> = {
  1: 'Muito suave',
  2: 'Suave',
  3: 'Médio',
  4: 'Encorpado',
  5: 'Muito encorpado',
};

export default function CigarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cigarQuery = useCigarDetail(id);

  if (cigarQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Charuto" />
        <LoadingState label="Carregando charuto..." />
      </Screen>
    );
  }

  if (cigarQuery.isError || !cigarQuery.data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Charuto" />
        <ErrorState message={getErrorMessage(cigarQuery.error)} onRetry={() => cigarQuery.refetch()} />
      </Screen>
    );
  }

  const cigar = cigarQuery.data;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={cigar.name} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.photoFrame}>
          <CigarCover url={cigar.imageUrl} brand={cigar.brand.name} name={cigar.name} style={styles.photo} />
        </View>

        <ThemedText variant="display" style={styles.name}>
          {cigar.name}
        </ThemedText>
        <ThemedText variant="body" color="textSecondary">
          {cigar.brand.name}
          {cigar.line ? ` · ${cigar.line}` : ''}
        </ThemedText>
        <ThemedText variant="caption" style={styles.metaLine}>
          {countryCodeToFlag(cigar.countryCode)} {cigar.countryCode}
          {cigar.vitola ? `  ·  ${cigar.vitola}` : ''}
        </ThemedText>

        <View style={styles.ratingSection}>
          <View style={styles.ratingHeader}>
            <ThemedText variant="display">{cigar.ratingAvg.toFixed(1)}</ThemedText>
            <View style={styles.ratingHeaderTexts}>
              <StarRating rating={cigar.ratingAvg} readOnly size={18} />
              <ThemedText variant="caption">{cigar.ratingCount} avaliações</ThemedText>
            </View>
          </View>
          <RatingDistributionBars distribution={cigar.ratingDistribution} />
        </View>

        <View style={styles.divider} />

        <ThemedText variant="title" style={styles.sectionTitle}>
          Ficha técnica
        </ThemedText>
        <View style={styles.specGrid}>
          <SpecItem label="Força" value={cigar.strength ? STRENGTH_LABELS[cigar.strength] : '—'} />
          <SpecItem
            label="Tempo médio"
            value={cigar.avgSmokeMinutes ? `${cigar.avgSmokeMinutes} min` : '—'}
          />
          <SpecItem label="Wrapper" value={cigar.wrapper ?? '—'} />
        </View>

        <View style={styles.actionsRow}>
          <PrimaryButton
            title="Avaliar"
            onPress={() => router.push(`/review/new?cigarId=${cigar.id}`)}
            style={styles.actionButton}
          />
          <PrimaryButton
            title="Adicionar ao umidor"
            onPress={() => router.push(`/humidor/add?cigarId=${cigar.id}`)}
            variant="outline"
            style={styles.actionButton}
          />
        </View>

        <View style={styles.divider} />

        <ThemedText variant="title" style={styles.sectionTitle}>
          Avaliações recentes
        </ThemedText>
        {cigar.recentReviews.length === 0 ? (
          <ThemedText variant="caption" style={styles.emptyReviews}>
            Nenhuma avaliação ainda. Seja o primeiro a avaliar!
          </ThemedText>
        ) : (
          cigar.recentReviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Avatar uri={review.user.avatarUrl} size={32} />
                <View style={styles.reviewHeaderTexts}>
                  <ThemedText variant="body">{review.user.displayName}</ThemedText>
                  <StarRating rating={review.rating} readOnly size={13} />
                </View>
              </View>
              {review.body ? (
                <ThemedText variant="body" style={styles.reviewBody}>
                  {review.body}
                </ThemedText>
              ) : null}
              {review.flavorNotes.length > 0 ? (
                <ThemedText variant="caption" style={styles.reviewFlavors}>
                  {review.flavorNotes.join(' · ')}
                </ThemedText>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.specItem}>
      <ThemedText variant="caption">{label}</ThemedText>
      <ThemedText variant="body">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: theme.spacing.xl },
  photoFrame: {
    width: '100%',
    maxHeight: 220,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceElevated,
  },
  photo: { width: '100%', height: 220 },
  photoPlaceholder: {},
  name: { marginTop: theme.spacing.md },
  metaLine: { marginTop: theme.spacing.xs },
  ratingSection: { marginTop: theme.spacing.lg },
  ratingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  ratingHeaderTexts: { marginLeft: theme.spacing.md },
  divider: { height: 1, backgroundColor: theme.colors.divider, marginVertical: theme.spacing.lg },
  sectionTitle: { marginBottom: theme.spacing.md },
  specGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  specItem: { flex: 1 },
  actionsRow: { marginTop: theme.spacing.lg },
  actionButton: { marginBottom: theme.spacing.sm },
  emptyReviews: { textAlign: 'center', paddingVertical: theme.spacing.lg },
  reviewCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center' },
  reviewHeaderTexts: { marginLeft: theme.spacing.sm },
  reviewBody: { marginTop: theme.spacing.sm },
  reviewFlavors: { marginTop: theme.spacing.xs },
});
