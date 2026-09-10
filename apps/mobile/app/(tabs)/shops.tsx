import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ThemedText } from '../../src/components/ThemedText';
import { TextField } from '../../src/components/TextField';
import { LoadingState } from '../../src/components/LoadingState';
import { EmptyState } from '../../src/components/EmptyState';
import { theme } from '../../src/theme';
import {
  DEFAULT_RADIUS_KM,
  FALLBACK_COORDINATES,
  FALLBACK_RADIUS_KM,
  ShopListItem,
  useDeviceLocation,
  useShopsNearbyQuery,
} from '../../src/api/hooks/use-shops';
import { getErrorMessage } from '../../src/lib/error-message';

// Charutarias por proximidade (Fase 3). O botão de balão no cabeçalho é o
// ponto de entrada escolhido para a lista de conversas (`app/chat/index.tsx`)
// — decisão documentada no resumo final do agente, já que a spec pede "poucas
// abas" e o chat não deve virar uma 6ª aba.
export default function ShopsScreen() {
  const { status, coords, requestLocation } = useDeviceLocation();
  const [cityInput, setCityInput] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedCity(cityInput), 400);
    return () => clearTimeout(handle);
  }, [cityInput]);

  const usingFallback = status === 'denied' || status === 'error';
  const params = useMemo(() => {
    if (status === 'idle' || status === 'requesting') return null;
    const base = coords ?? FALLBACK_COORDINATES;
    return {
      lat: base.lat,
      lng: base.lng,
      city: debouncedCity.trim() || undefined,
      radiusKm: coords ? DEFAULT_RADIUS_KM : FALLBACK_RADIUS_KM,
    };
  }, [status, coords, debouncedCity]);

  const shopsQuery = useShopsNearbyQuery(params);
  const shops = useMemo(() => shopsQuery.data?.pages.flatMap((page) => page.items) ?? [], [shopsQuery.data]);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText variant="display" style={styles.title}>
          Charutarias
        </ThemedText>
        <Pressable onPress={() => router.push('/chat')} hitSlop={10}>
          <Ionicons name="chatbubbles-outline" size={24} color={theme.colors.textPrimary} />
        </Pressable>
      </View>

      <TextField
        placeholder="Filtrar por cidade..."
        value={cityInput}
        onChangeText={setCityInput}
        autoCapitalize="none"
      />

      {usingFallback ? (
        <View style={styles.locationBanner}>
          <Ionicons name="location-outline" size={16} color={theme.colors.gold} />
          <ThemedText variant="caption" style={styles.locationBannerText}>
            Sem acesso à sua localização exata — mostrando charutarias a partir de São Paulo. Use o filtro de cidade
            ou{' '}
            <ThemedText variant="caption" color="gold" onPress={requestLocation}>
              tente novamente
            </ThemedText>
            .
          </ThemedText>
        </View>
      ) : null}

      {status === 'idle' || status === 'requesting' || shopsQuery.isLoading ? (
        <LoadingState label="Buscando charutarias próximas..." />
      ) : shopsQuery.isError ? (
        <EmptyState
          icon="storefront-outline"
          message={getErrorMessage(
            shopsQuery.error,
            'Não foi possível buscar charutarias agora. Tente novamente em instantes.',
          )}
        />
      ) : (
        <FlatList
          data={shops}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <ShopCard shop={item} />}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (shopsQuery.hasNextPage && !shopsQuery.isFetchingNextPage) shopsQuery.fetchNextPage();
          }}
          ListEmptyComponent={
            <EmptyState icon="storefront-outline" message="Nenhuma charutaria encontrada por perto." />
          }
          ListFooterComponent={shopsQuery.isFetchingNextPage ? <LoadingState /> : null}
        />
      )}
    </Screen>
  );
}

function ShopCard({ shop }: { shop: ShopListItem }) {
  const responseLabel =
    shop.avgResponseSeconds != null
      ? `Responde em ~${Math.round(shop.avgResponseSeconds / 60)} min`
      : shop.responseRate != null
        ? `Taxa de resposta: ${Math.round(shop.responseRate)}%`
        : null;

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/shop/${shop.id}`)}>
      <View style={styles.cardIcon}>
        <Ionicons name="storefront" size={22} color={theme.colors.gold} />
      </View>
      <View style={styles.cardTexts}>
        <View style={styles.cardTitleRow}>
          <ThemedText variant="body" numberOfLines={1} style={styles.cardName}>
            {shop.tradeName}
          </ThemedText>
          {shop.isVerified ? <Ionicons name="checkmark-circle" size={14} color={theme.colors.gold} /> : null}
        </View>
        <ThemedText variant="caption" numberOfLines={1}>
          {shop.distanceKm.toFixed(1)} km · {shop.address}
        </ThemedText>
        {responseLabel ? (
          <ThemedText variant="caption" color="textTertiary" style={styles.responseLabel}>
            {responseLabel}
          </ThemedText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  title: { flex: 1 },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  locationBannerText: { flex: 1, marginLeft: theme.spacing.sm },
  listContent: { paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTexts: { flex: 1, marginLeft: theme.spacing.md },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center' },
  cardName: { flex: 0, marginRight: theme.spacing.xs },
  responseLabel: { marginTop: 2 },
});
