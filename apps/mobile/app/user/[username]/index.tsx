import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { LoadingState } from '../../../src/components/LoadingState';
import { ErrorState } from '../../../src/components/ErrorState';
import { ProfileHeader } from '../../../src/components/ProfileHeader';
import { PostsGrid } from '../../../src/components/PostsGrid';
import { FollowButton } from '../../../src/components/FollowButton';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { ThemedText } from '../../../src/components/ThemedText';
import { ActionSheet } from '../../../src/components/ActionSheet';
import { theme } from '../../../src/theme';
import { useCurrentUserClaims } from '../../../src/lib/current-user';
import {
  useAcceptFollowMutation,
  useBlockUserMutation,
  useFollowMutation,
  useFollowRequestsQuery,
  useRejectFollowMutation,
  useReportUserMutation,
  useUnfollowMutation,
  useUserProfileQuery,
} from '../../../src/api/hooks/use-profile';
import { useUserPostsQuery } from '../../../src/api/hooks/use-posts';
import { getErrorMessage } from '../../../src/lib/error-message';

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const claims = useCurrentUserClaims();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (claims && username && claims.username === username) {
      router.replace('/(tabs)/profile');
    }
  }, [claims, username]);

  const profileQuery = useUserProfileQuery(username);
  const postsQuery = useUserPostsQuery(profileQuery.data?.id);
  const followRequestsQuery = useFollowRequestsQuery();

  const followMutation = useFollowMutation();
  const unfollowMutation = useUnfollowMutation();
  const acceptMutation = useAcceptFollowMutation();
  const rejectMutation = useRejectFollowMutation();
  const blockMutation = useBlockUserMutation();
  const reportMutation = useReportUserMutation();

  const posts = useMemo(() => postsQuery.data?.pages.flatMap((page) => page.items) ?? [], [postsQuery.data]);

  const user = profileQuery.data;

  const incomingRequest = useMemo(
    () => (user ? followRequestsQuery.data?.find((requester) => requester.id === user.id) : undefined),
    [followRequestsQuery.data, user],
  );

  const handleShare = async () => {
    if (!user) return;
    const message = `Perfil de ${user.displayName} (@${user.username}) no Vitola Hub`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Vitola Hub', text: message });
      } else {
        await Share.share({ message });
      }
    } catch {
      // usuário cancelou o share
    }
  };

  const handleBlock = () => {
    if (!user) return;
    const run = () =>
      blockMutation.mutate(
        { userId: user.id, username: user.username },
        {
          onSuccess: () => {
            Alert.alert('Usuário bloqueado', `@${user.username} foi bloqueado.`);
            router.back();
          },
          onError: (error) => Alert.alert('Erro', getErrorMessage(error)),
        },
      );

    if (Platform.OS === 'web') {
      // Confirm nativo do browser — Alert.alert com botões é frágil no Web.
      if (typeof window !== 'undefined' && window.confirm(`Bloquear @${user.username}?`)) run();
      return;
    }
    Alert.alert('Bloquear usuário', `Tem certeza que deseja bloquear @${user.username}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Bloquear', style: 'destructive', onPress: run },
    ]);
  };

  const handleReport = () => {
    if (!user) return;
    const reason = 'Conteúdo ou comportamento inadequado';
    reportMutation.mutate(
      { userId: user.id, reason },
      {
        onSuccess: () => Alert.alert('Denúncia enviada', 'Nossa equipe vai analisar este perfil.'),
        onError: (error) => Alert.alert('Erro', getErrorMessage(error)),
      },
    );
  };

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Perfil" />
        <LoadingState label="Carregando perfil..." />
      </Screen>
    );
  }

  if (profileQuery.isError || !user) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Perfil" />
        <ErrorState message={getErrorMessage(profileQuery.error)} onRetry={() => profileQuery.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title={user.displayName}
        right={
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityLabel="Opções do perfil">
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.textPrimary} />
          </Pressable>
        }
      />

      <ActionSheet
        visible={menuOpen}
        title={`@${user.username}`}
        onClose={() => setMenuOpen(false)}
        items={[
          { label: 'Compartilhar perfil', icon: 'share-outline', onPress: handleShare },
          { label: 'Denunciar', icon: 'flag-outline', onPress: handleReport, destructive: true },
          { label: 'Bloquear', icon: 'ban-outline', onPress: handleBlock, destructive: true },
        ]}
      />

      <PostsGrid
        posts={posts}
        emptyMessage="Este usuário ainda não publicou nada."
        loadingMore={postsQuery.isFetchingNextPage}
        onEndReached={() => {
          if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) postsQuery.fetchNextPage();
        }}
        ListHeaderComponent={
          <View>
            <ProfileHeader
              user={user}
              onPressFollowers={() => router.push(`/user/${user.username}/followers`)}
              onPressFollowing={() => router.push(`/user/${user.username}/following`)}
              rightActions={
                <FollowButton
                  status={user.isFollowedByMe}
                  loading={followMutation.isPending || unfollowMutation.isPending}
                  onFollow={() => followMutation.mutate({ userId: user.id, username: user.username })}
                  onUnfollow={() => unfollowMutation.mutate({ userId: user.id, username: user.username })}
                />
              }
            />

            {incomingRequest ? (
              <View style={styles.requestBanner}>
                <ThemedText variant="body" style={styles.requestText}>
                  {user.displayName} quer seguir você
                </ThemedText>
                <View style={styles.requestActions}>
                  <PrimaryButton
                    title="Aceitar"
                    onPress={() => acceptMutation.mutate(user.id)}
                    loading={acceptMutation.isPending}
                    style={styles.requestButton}
                  />
                  <PrimaryButton
                    title="Recusar"
                    onPress={() => rejectMutation.mutate(user.id)}
                    variant="outline"
                    disabled={acceptMutation.isPending}
                    style={styles.requestButton}
                  />
                </View>
              </View>
            ) : null}

            <ThemedText variant="title" style={styles.gridTitle}>
              Publicações
            </ThemedText>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  requestBanner: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceElevated,
  },
  requestText: { marginBottom: theme.spacing.sm },
  requestActions: { flexDirection: 'row' },
  requestButton: { marginRight: theme.spacing.sm, minHeight: 36, paddingHorizontal: theme.spacing.md },
  gridTitle: { marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm },
});
