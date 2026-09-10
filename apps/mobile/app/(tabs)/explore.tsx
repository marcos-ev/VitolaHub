import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CigarCover } from '../../src/components/CigarCover';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ThemedText } from '../../src/components/ThemedText';
import { TextField } from '../../src/components/TextField';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { UserListItem } from '../../src/components/UserListItem';
import { PostsGrid } from '../../src/components/PostsGrid';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { EmptyState } from '../../src/components/EmptyState';
import { theme } from '../../src/theme';
import { useCigarSearch } from '../../src/api/hooks/use-catalog';
import { useExplorePostsQuery, usePeopleSearch, useSuggestedPeople } from '../../src/api/hooks/use-explore';
import { useDeviceLocation, useShopsNearbyQuery, FALLBACK_COORDINATES, FALLBACK_RADIUS_KM } from '../../src/api/hooks/use-shops';
import { PostSummaryExt } from '../../src/api/types';
import { getErrorMessage } from '../../src/lib/error-message';
import { countryCodeToFlag } from '../../src/lib/country';

type ResultTab = 'cigars' | 'people' | 'shops';

const TABS: { value: ResultTab; label: string }[] = [
  { value: 'cigars', label: 'Charutos' },
  { value: 'people', label: 'Pessoas' },
  { value: 'shops', label: 'Charutarias' },
];

// Busca unificada (seção "Explorar" do enunciado): charutos primeiro (já tem
// endpoint pronto), depois pessoas (SUPOSIÇÃO documentada em
// `use-explore.ts`: sem endpoint de busca de pessoas ainda, mostramos
// placeholder) e por último charutarias (reaproveita `use-shops.ts`; se a
// localização não estiver disponível, cai para o fallback documentado ali).
// Sem busca ativa, mostramos "pessoas sugeridas" (placeholder) e uma grade de
// publicações públicas recentes (reaproveitando `PostsGrid`).
export default function ExploreScreen() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tab, setTab] = useState<ResultTab>('cigars');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const isSearching = debouncedSearch.trim().length >= 2;

  const cigarSearch = useCigarSearch(isSearching && tab === 'cigars' ? debouncedSearch : '');
  const peopleSearch = usePeopleSearch(isSearching && tab === 'people' ? debouncedSearch : '');
  const suggestedPeople = useSuggestedPeople();

  const { coords } = useDeviceLocation();
  const shopsParams = useMemo(() => {
    if (tab !== 'shops' || !isSearching) return null;
    const base = coords ?? FALLBACK_COORDINATES;
    return { lat: base.lat, lng: base.lng, city: debouncedSearch, radiusKm: coords ? undefined : FALLBACK_RADIUS_KM };
  }, [tab, isSearching, coords, debouncedSearch]);
  const shopsSearch = useShopsNearbyQuery(shopsParams);
  const shopsResults = useMemo(() => shopsSearch.data?.pages.flatMap((page) => page.items) ?? [], [shopsSearch.data]);

  const explorePosts = useExplorePostsQuery();
  const posts = useMemo<PostSummaryExt[]>(
    () => explorePosts.data?.pages.flatMap((page) => page.items) ?? [],
    [explorePosts.data],
  );

  return (
    <Screen>
      <ThemedText variant="display" style={styles.title}>
        Explorar
      </ThemedText>

      <TextField
        placeholder="Buscar charutos, pessoas ou charutarias..."
        value={searchInput}
        onChangeText={setSearchInput}
        autoCapitalize="none"
      />

      {isSearching ? (
        <View style={styles.searchArea}>
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />

          {tab === 'cigars' ? (
            cigarSearch.isLoading ? (
              <LoadingState label="Buscando charutos..." />
            ) : cigarSearch.isError ? (
              <ErrorState message={getErrorMessage(cigarSearch.error)} onRetry={() => cigarSearch.refetch()} />
            ) : (
              <FlatList
                data={cigarSearch.data?.items ?? []}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.resultsList}
                renderItem={({ item }) => (
                  <Pressable style={styles.cigarRow} onPress={() => router.push(`/cigar/${item.id}`)}>
                    <CigarCover url={item.imageUrl} brand={item.brand.name} name={item.name} style={styles.cigarThumb} />
                    <View style={styles.cigarTexts}>
                      <ThemedText variant="body" numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                      <ThemedText variant="caption" numberOfLines={1}>
                        {item.brand.name} · {countryCodeToFlag(item.countryCode)} {item.countryCode}
                      </ThemedText>
                    </View>
                  </Pressable>
                )}
                ListEmptyComponent={<EmptyState icon="search-outline" message="Nenhum charuto encontrado." />}
              />
            )
          ) : null}

          {tab === 'people' ? (
            peopleSearch.isLoading ? (
              <LoadingState label="Buscando pessoas..." />
            ) : (
              <FlatList
                data={peopleSearch.data ?? []}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.resultsList}
                renderItem={({ item }) => (
                  <UserListItem user={item} onPress={() => router.push(`/user/${item.username}`)} />
                )}
                ListEmptyComponent={
                  <EmptyState
                    icon="people-outline"
                    message="Nenhuma pessoa encontrada com esse nome. Tente o @usuario."
                  />
                }
              />
            )
          ) : null}

          {tab === 'shops' ? (
            shopsSearch.isLoading ? (
              <LoadingState label="Buscando charutarias..." />
            ) : shopsSearch.isError ? (
              <EmptyState
                icon="storefront-outline"
                message="Não foi possível buscar charutarias agora. Tente novamente na aba Charutarias."
              />
            ) : (
              <FlatList
                data={shopsResults}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.resultsList}
                renderItem={({ item }) => (
                  <Pressable style={styles.shopRow} onPress={() => router.push(`/shop/${item.id}`)}>
                    <View style={styles.shopIcon}>
                      <Ionicons name="storefront-outline" size={20} color={theme.colors.gold} />
                    </View>
                    <View style={styles.cigarTexts}>
                      <ThemedText variant="body" numberOfLines={1}>
                        {item.tradeName}
                      </ThemedText>
                      <ThemedText variant="caption" numberOfLines={1}>
                        {item.distanceKm.toFixed(1)} km · {item.address}
                      </ThemedText>
                    </View>
                  </Pressable>
                )}
                ListEmptyComponent={<EmptyState icon="storefront-outline" message="Nenhuma charutaria encontrada." />}
              />
            )
          ) : null}
        </View>
      ) : (
        <PostsGrid
          posts={posts}
          loadingMore={explorePosts.isFetchingNextPage}
          onEndReached={() => {
            if (explorePosts.hasNextPage && !explorePosts.isFetchingNextPage) explorePosts.fetchNextPage();
          }}
          emptyMessage={
            explorePosts.isLoading ? 'Carregando publicações...' : 'Nenhuma publicação pública por aqui ainda.'
          }
          ListHeaderComponent={
            <View>
              <ThemedText variant="title" style={styles.sectionTitle}>
                Pessoas sugeridas
              </ThemedText>
              {suggestedPeople.data && suggestedPeople.data.length > 0 ? (
                suggestedPeople.data.map((user) => (
                  <UserListItem key={user.id} user={user} onPress={() => router.push(`/user/${user.username}`)} />
                ))
              ) : (
                <EmptyState icon="people-outline" message="Nenhuma sugestão agora. Busque pelo nome ou @usuario." />
              )}

              <ThemedText variant="title" style={styles.sectionTitle}>
                Publicações recentes
              </ThemedText>
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: theme.spacing.md },
  searchArea: { flex: 1 },
  resultsList: { paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xl },
  sectionTitle: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  cigarRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm },
  cigarThumb: { width: 44, height: 44, borderRadius: theme.radii.sm, backgroundColor: theme.colors.surfaceElevated },
  cigarThumbPlaceholder: {},
  cigarTexts: { flex: 1, marginLeft: theme.spacing.sm },
  shopRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm },
  shopIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
