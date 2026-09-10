import { FlatList, StyleSheet } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { LoadingState } from '../../../src/components/LoadingState';
import { ErrorState } from '../../../src/components/ErrorState';
import { EmptyState } from '../../../src/components/EmptyState';
import { UserListItem } from '../../../src/components/UserListItem';
import { theme } from '../../../src/theme';
import { useFollowersQuery, useUserProfileQuery } from '../../../src/api/hooks/use-profile';
import { getErrorMessage } from '../../../src/lib/error-message';

export default function FollowersScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const profileQuery = useUserProfileQuery(username);
  const followersQuery = useFollowersQuery(profileQuery.data?.id);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Seguidores" />

      {profileQuery.isLoading || followersQuery.isLoading ? (
        <LoadingState label="Carregando seguidores..." />
      ) : followersQuery.isError ? (
        <ErrorState message={getErrorMessage(followersQuery.error)} onRetry={() => followersQuery.refetch()} />
      ) : (
        <FlatList
          data={followersQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <UserListItem user={item} onPress={() => router.push(`/user/${item.username}`)} />
          )}
          ListEmptyComponent={<EmptyState icon="people-outline" message="Nenhum seguidor ainda." />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: theme.spacing.xl },
});
