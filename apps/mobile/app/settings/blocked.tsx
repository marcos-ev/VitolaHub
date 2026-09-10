import { FlatList, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { LoadingState } from '../../src/components/LoadingState';
import { EmptyState } from '../../src/components/EmptyState';
import { UserListItem } from '../../src/components/UserListItem';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { theme } from '../../src/theme';
import { useBlockedUsersQuery, useUnblockUserMutation } from '../../src/api/hooks/use-profile';

export default function BlockedUsersScreen() {
  const blockedQuery = useBlockedUsersQuery();
  const unblockMutation = useUnblockUserMutation();

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Bloqueados" />

      {blockedQuery.isLoading ? (
        <LoadingState label="Carregando..." />
      ) : (
        <FlatList
          data={blockedQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <UserListItem
              user={item}
              right={
                <PrimaryButton
                  title="Desbloquear"
                  onPress={() => unblockMutation.mutate(item.id)}
                  variant="outline"
                  loading={unblockMutation.isPending}
                  style={styles.unblockButton}
                />
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState icon="ban-outline" message="Você não tem ninguém bloqueado." />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: theme.spacing.xl },
  unblockButton: { minHeight: 36, paddingHorizontal: theme.spacing.md },
});
