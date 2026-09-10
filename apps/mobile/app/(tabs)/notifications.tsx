import { useMemo } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { EmptyState } from '../../src/components/EmptyState';
import { NotificationRow } from '../../src/components/NotificationRow';
import { theme } from '../../src/theme';
import {
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from '../../src/api/hooks/use-notifications';
import { useAcceptFollowMutation, useRejectFollowMutation } from '../../src/api/hooks/use-profile';
import { getErrorMessage } from '../../src/lib/error-message';
import { NotificationItem } from '../../src/api/types';

export default function NotificationsScreen() {
  const notificationsQuery = useNotificationsQuery();
  const markRead = useMarkNotificationReadMutation();
  const acceptFollow = useAcceptFollowMutation();
  const rejectFollow = useRejectFollowMutation();

  const notifications = useMemo<NotificationItem[]>(
    () => notificationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [notificationsQuery.data],
  );

  const handlePress = (item: NotificationItem) => {
    if (!item.readAt) markRead.mutate(item.id);
    if (item.entityType === 'POST' && item.entityId) {
      router.push(item.type === 'COMMENT' ? `/post/${item.entityId}?focus=comment` : `/post/${item.entityId}`);
      return;
    }
    if (item.type === 'ACHIEVEMENT_UNLOCKED') {
      router.push('/(tabs)/profile');
      return;
    }
    if (item.type === 'TRIAL_ENDING' || item.type === 'TRIAL_EXPIRED') {
      router.push('/settings/paywall');
      return;
    }
    if (item.actor) router.push(`/user/${item.actor.username}`);
  };

  return (
    <Screen>
      <ScreenHeader title="Notificações" />

      {notificationsQuery.isLoading ? (
        <LoadingState label="Carregando notificações..." />
      ) : notificationsQuery.isError ? (
        <ErrorState message={getErrorMessage(notificationsQuery.error)} onRetry={() => notificationsQuery.refetch()} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <NotificationRow
              notification={item}
              onPress={() => handlePress(item)}
              onAccept={
                item.type === 'FOLLOW_REQUEST' && item.actor
                  ? () => acceptFollow.mutate(item.actor!.id)
                  : undefined
              }
              onReject={
                item.type === 'FOLLOW_REQUEST' && item.actor
                  ? () => rejectFollow.mutate(item.actor!.id)
                  : undefined
              }
              actionsLoading={acceptFollow.isPending || rejectFollow.isPending}
            />
          )}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage) {
              notificationsQuery.fetchNextPage();
            }
          }}
          ListEmptyComponent={
            <EmptyState icon="notifications-outline" message="Você ainda não tem notificações." />
          }
          ListFooterComponent={notificationsQuery.isFetchingNextPage ? <LoadingState /> : null}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: theme.spacing.xl },
});
