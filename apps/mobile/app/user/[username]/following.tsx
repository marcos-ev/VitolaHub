import { FlatList, StyleSheet } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { LoadingState } from '../../../src/components/LoadingState';
import { ErrorState } from '../../../src/components/ErrorState';
import { EmptyState } from '../../../src/components/EmptyState';
import { UserListItem } from '../../../src/components/UserListItem';
import { theme } from '../../../src/theme';
import { useFollowingQuery, useUserProfileQuery } from '../../../src/api/hooks/use-profile';
import { getErrorMessage } from '../../../src/lib/error-message';

export default function FollowingScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const profileQuery = useUserProfileQuery(username);
  const followingQuery = useFollowingQuery(profileQuery.data?.id);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Seguindo" />

      {profileQuery.isLoading || followingQuery.isLoading ? (
        <LoadingState label="Carregando..." />
      ) : followingQuery.isError ? (
        <ErrorState message={getErrorMessage(followingQuery.error)} onRetry={() => followingQuery.refetch()} />
      ) : (
        <FlatList
          data={followingQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <UserListItem user={item} onPress={() => router.push(`/user/${item.username}`)} />
          )}
          ListEmptyComponent={<EmptyState icon="people-outline" message="Ainda não segue ninguém." />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: theme.spacing.xl },
});
