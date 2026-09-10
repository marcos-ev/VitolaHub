import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { EmptyState } from '../../src/components/EmptyState';
import { StarRating } from '../../src/components/StarRating';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { theme } from '../../src/theme';
import { useReviewHistory } from '../../src/api/hooks/use-stats';
import { ReviewHistoryItem } from '../../src/api/types';
import { getErrorMessage } from '../../src/lib/error-message';

export default function ReviewHistoryScreen() {
  const historyQuery = useReviewHistory();

  const items = useMemo(() => historyQuery.data?.pages.flatMap((page) => page.items) ?? [], [historyQuery.data]);
  const limitedToDays = historyQuery.data?.pages[0]?.historyLimitedToDays ?? null;

  if (historyQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Histórico de avaliações" />
        <LoadingState label="Carregando histórico..." />
      </Screen>
    );
  }

  if (historyQuery.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Histórico de avaliações" />
        <ErrorState message={getErrorMessage(historyQuery.error)} onRetry={() => historyQuery.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Histórico de avaliações" />

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          limitedToDays != null ? (
            <View style={styles.banner}>
              <ThemedText variant="caption" style={styles.bannerText}>
                Mostrando os últimos {limitedToDays} dias — assine para ver o histórico completo
              </ThemedText>
              <Pressable onPress={() => router.push('/settings/paywall')} hitSlop={8}>
                <ThemedText variant="caption" color="gold">
                  Assinar
                </ThemedText>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState icon="time-outline" message="Você ainda não tem avaliações registradas." />}
        renderItem={({ item }) => <HistoryRow item={item} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (historyQuery.hasNextPage && !historyQuery.isFetchingNextPage) historyQuery.fetchNextPage();
        }}
        ListFooterComponent={historyQuery.isFetchingNextPage ? <LoadingState /> : null}
      />
    </Screen>
  );
}

function HistoryRow({ item }: { item: ReviewHistoryItem }) {
  const date = new Date(item.createdAt).toLocaleDateString('pt-BR');

  return (
    <Pressable style={styles.row} onPress={() => router.push(`/cigar/${item.cigarId}`)}>
      {/* `GET /stats/history` não traz imagem do charuto (só ficha básica) — ícone fixo no lugar. */}
      <View style={[styles.rowImage, styles.rowImagePlaceholder]}>
        <Ionicons name="leaf-outline" size={18} color={theme.colors.textTertiary} />
      </View>
      <View style={styles.rowTexts}>
        <ThemedText variant="body" numberOfLines={1}>
          {item.cigar.name}
        </ThemedText>
        <ThemedText variant="caption" numberOfLines={1}>
          {item.cigar.brand.name}
        </ThemedText>
        <StarRating rating={item.rating} readOnly size={13} />
      </View>
      <ThemedText variant="caption" color="textTertiary">
        {date}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: theme.spacing.xl },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  bannerText: { flex: 1, marginRight: theme.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  rowImage: { width: 44, height: 44, borderRadius: theme.radii.sm, backgroundColor: theme.colors.surfaceElevated },
  rowImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  rowTexts: { flex: 1, marginLeft: theme.spacing.md, marginRight: theme.spacing.sm },
});
