import { useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ThemedText } from '../../src/components/ThemedText';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { NotificationBell } from '../../src/components/NotificationBell';
import { PostCard } from '../../src/components/PostCard';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { EmptyState } from '../../src/components/EmptyState';
import { theme } from '../../src/theme';
import { FeedTab, useFeedQuery, useToggleLikeMutation } from '../../src/api/hooks/use-feed';
import { useHasUnreadNotifications } from '../../src/api/hooks/use-notifications';
import { getErrorMessage } from '../../src/lib/error-message';
import { PostSummaryExt } from '../../src/api/types';

const TABS: { value: FeedTab; label: string }[] = [
  { value: 'forYou', label: 'Para você' },
  { value: 'following', label: 'Seguindo' },
];

export default function FeedScreen() {
  const [tab, setTab] = useState<FeedTab>('forYou');
  const feedQuery = useFeedQuery(tab);
  const toggleLike = useToggleLikeMutation();
  const hasUnread = useHasUnreadNotifications();
  const listRef = useRef<FlatList<PostSummaryExt>>(null);

  const goHome = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const posts = useMemo<PostSummaryExt[]>(
    () => feedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [feedQuery.data],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.brandRow} onPress={goHome} accessibilityLabel="Ir ao início">
          <Image source={require('../../assets/logo.png')} style={styles.logo} />
          <ThemedText variant="display" style={styles.title}>
            VITOLA
          </ThemedText>
        </Pressable>
        <View style={styles.headerActions}>
          <NotificationBell hasUnread={hasUnread} onPress={() => router.push('/(tabs)/notifications')} />
        </View>
      </View>

      <SegmentedControl options={TABS} value={tab} onChange={setTab} />

      {feedQuery.isLoading ? (
        <LoadingState label="Carregando feed..." />
      ) : feedQuery.isError ? (
        <ErrorState message={getErrorMessage(feedQuery.error)} onRetry={() => feedQuery.refetch()} />
      ) : (
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onToggleLike={() => toggleLike.mutate({ postId: item.id, liked: item.likedByMe })}
            />
          )}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) feedQuery.fetchNextPage();
          }}
          ListEmptyComponent={
            <Pressable onPress={() => router.push('/post/new')}>
              <EmptyState
                icon="leaf-outline"
                message={
                  tab === 'following'
                    ? 'As pessoas que você segue ainda não publicaram. Toque para publicar a primeira foto.'
                    : 'Nada no feed ainda. Toque para publicar sua primeira foto.'
                }
              />
            </Pressable>
          }
          ListFooterComponent={feedQuery.isFetchingNextPage ? <LoadingState /> : null}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 32, height: 32, borderRadius: 16, marginRight: theme.spacing.sm },
  title: { letterSpacing: 3, fontSize: 22, fontFamily: theme.fonts.brand },
  listContent: { paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
});
