import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FeatureKey } from '@charuto/shared';
import { Screen } from '../../src/components/Screen';
import { ThemedText } from '../../src/components/ThemedText';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { ProfileHeader } from '../../src/components/ProfileHeader';
import { PostsGrid } from '../../src/components/PostsGrid';
import { ActionSheet } from '../../src/components/ActionSheet';
import { theme } from '../../src/theme';
import { useCurrentUserClaims } from '../../src/lib/current-user';
import { useUserProfileQuery, useUpdateProfileMutation } from '../../src/api/hooks/use-profile';
import { useUserPostsQuery } from '../../src/api/hooks/use-posts';
import { useImageUpload } from '../../src/api/hooks/use-media';
import { useLogoutMutation } from '../../src/api/hooks/use-auth';
import { useEntitlements, hasFeature } from '../../src/api/hooks/use-entitlements';
import { useMyAchievementsQuery } from '../../src/api/hooks/use-achievements';
import { useHumidorListQuery } from '../../src/api/hooks/use-humidor';
import { getErrorMessage } from '../../src/lib/error-message';
import { pickImageFrom } from '../../src/lib/pick-image';

function trialLabel(trialEndsAt: string | null | undefined, isTrial: boolean | undefined): string | null {
  if (!isTrial || !trialEndsAt) return null;
  const days = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
  return `TESTE · ${days} DIA${days === 1 ? '' : 'S'}`;
}

export default function ProfileScreen() {
  const claims = useCurrentUserClaims();
  const profileQuery = useUserProfileQuery(claims?.username);
  const postsQuery = useUserPostsQuery(profileQuery.data?.id);
  const entitlements = useEntitlements();
  const achievementsQuery = useMyAchievementsQuery();
  const humidorQuery = useHumidorListQuery();
  const uploadImage = useImageUpload();
  const updateProfile = useUpdateProfileMutation();
  const logoutMutation = useLogoutMutation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);

  const posts = useMemo(() => postsQuery.data?.pages.flatMap((page) => page.items) ?? [], [postsQuery.data]);
  const achievements = useMemo(() => (achievementsQuery.data ?? []).slice(0, 6), [achievementsQuery.data]);
  const unlockedCount = useMemo(
    () => (achievementsQuery.data ?? []).filter((a) => a.unlockedAt).length,
    [achievementsQuery.data],
  );
  const humidorTotal = humidorQuery.data?.total ?? 0;
  const reviewCount = posts.length; // aproximação até haver endpoint dedicado
  const tasteLocked = !hasFeature(entitlements.data, FeatureKey.TASTE_STATS);
  const badge = trialLabel(entitlements.data?.trialEndsAt, entitlements.data?.isTrial);

  const uploadAvatar = async (source: 'camera' | 'library') => {
    const picked = await pickImageFrom(source);
    if (!picked) return;
    try {
      const publicUrl = await uploadImage.mutateAsync({ uri: picked.uri, folder: 'avatars' });
      await updateProfile.mutateAsync({ avatarUrl: publicUrl });
    } catch (error) {
      Alert.alert('Erro', getErrorMessage(error, 'Não foi possível atualizar sua foto.'));
    }
  };

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <LoadingState label="Carregando perfil..." />
      </Screen>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <Screen>
        <ErrorState message={getErrorMessage(profileQuery.error)} onRetry={() => profileQuery.refetch()} />
      </Screen>
    );
  }

  const user = profileQuery.data;

  const handleShare = async () => {
    const message = `Meu perfil no Vitola Hub: @${user.username}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Vitola Hub', text: message });
      } else {
        await Share.share({ message });
      }
    } catch {
      // cancelado
    }
  };

  return (
    <Screen>
      <ActionSheet
        visible={menuOpen}
        title="Opções"
        onClose={() => setMenuOpen(false)}
        items={[
          { label: 'Configurações', icon: 'settings-outline', onPress: () => router.push('/settings') },
          { label: 'Suporte', icon: 'help-buoy-outline', onPress: () => router.push('/settings/support') },
          {
            label: 'Quero ser fundador',
            icon: 'ribbon-outline',
            onPress: () => router.push('/settings/founding'),
          },
          { label: 'Compartilhar perfil', icon: 'share-outline', onPress: handleShare },
          { label: 'Convites', icon: 'gift-outline', onPress: () => router.push('/invite') },
          {
            label: 'Sair da conta',
            icon: 'log-out-outline',
            destructive: true,
            onPress: () => {
              Alert.alert('Sair da conta', 'Deseja mesmo sair?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Sair',
                  style: 'destructive',
                  onPress: () => {
                    logoutMutation.mutate(undefined, {
                      onSettled: () => router.replace('/(auth)/login'),
                    });
                  },
                },
              ]);
            },
          },
        ]}
      />
      <ActionSheet
        visible={avatarSheetOpen}
        title="Foto de perfil"
        onClose={() => setAvatarSheetOpen(false)}
        items={[
          { label: 'Tirar foto', icon: 'camera-outline', onPress: () => uploadAvatar('camera') },
          { label: 'Escolher da galeria', icon: 'image-outline', onPress: () => uploadAvatar('library') },
        ]}
      />
      <PostsGrid
        posts={posts}
        emptyMessage="Você ainda não publicou nada."
        loadingMore={postsQuery.isFetchingNextPage}
        onEndReached={() => {
          if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) postsQuery.fetchNextPage();
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityLabel="Menu do perfil">
                <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.textPrimary} />
              </Pressable>
              <Pressable onPress={handleShare} hitSlop={10} accessibilityLabel="Compartilhar perfil">
                <Ionicons name="share-outline" size={24} color={theme.colors.textPrimary} />
              </Pressable>
            </View>

            <ProfileHeader
              user={user}
              onAvatarPress={() => setAvatarSheetOpen(true)}
              avatarUploading={uploadImage.isPending || updateProfile.isPending}
              onPressFollowers={() => router.push(`/user/${user.username}/followers`)}
              onPressFollowing={() => router.push(`/user/${user.username}/following`)}
            />

            {badge ? (
              <View style={styles.trialBadge}>
                <ThemedText variant="caption" color="gold" style={styles.trialBadgeText}>
                  {badge}
                </ThemedText>
              </View>
            ) : entitlements.data?.isPremium ? (
              <View style={styles.trialBadge}>
                <ThemedText variant="caption" color="gold" style={styles.trialBadgeText}>
                  PREMIUM
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <ThemedText variant="title">{reviewCount}</ThemedText>
                <ThemedText variant="caption">Avaliações</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText variant="title">{user.friendCount}</ThemedText>
                <ThemedText variant="caption">Amigos</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText variant="title">{unlockedCount}</ThemedText>
                <ThemedText variant="caption">Selos</ThemedText>
              </View>
            </View>

            <Pressable
              style={styles.tasteCard}
              onPress={() => router.push(tasteLocked ? '/settings/paywall' : '/stats')}
            >
              <Ionicons name="stats-chart-outline" size={22} color={theme.colors.gold} />
              <View style={styles.tasteTexts}>
                <ThemedText variant="body" style={styles.tasteTitle}>
                  Estatísticas do paladar
                </ThemedText>
                {tasteLocked ? (
                  <ThemedText variant="caption" color="textTertiary">
                    Disponível no Premium
                  </ThemedText>
                ) : (
                  <ThemedText variant="caption" color="textTertiary">
                    Ver seu perfil de sabor
                  </ThemedText>
                )}
              </View>
              <Ionicons
                name={tasteLocked ? 'lock-closed' : 'chevron-forward'}
                size={18}
                color={theme.colors.textTertiary}
              />
            </Pressable>

            <ThemedText variant="caption" color="gold" style={styles.sectionLabel}>
              CONQUISTAS
            </ThemedText>
            <View style={styles.achievementsGrid}>
              {achievements.map((item) => {
                const unlocked = !!item.unlockedAt;
                return (
                  <View key={item.code} style={[styles.achievementCard, !unlocked && styles.achievementLocked]}>
                    <Ionicons
                      name={(item.icon as keyof typeof Ionicons.glyphMap) || 'ribbon-outline'}
                      size={22}
                      color={unlocked ? theme.colors.gold : theme.colors.textTertiary}
                    />
                    <ThemedText
                      variant="caption"
                      color={unlocked ? 'textPrimary' : 'textTertiary'}
                      numberOfLines={2}
                      style={styles.achievementName}
                    >
                      {item.name}
                    </ThemedText>
                    <ThemedText variant="caption" color="textTertiary">
                      {item.current}/{item.target}
                    </ThemedText>
                  </View>
                );
              })}
              {achievements.length === 0 ? (
                <ThemedText variant="caption" color="textTertiary">
                  Carregando conquistas...
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.humidorHeader}>
              <ThemedText variant="caption" color="gold" style={styles.sectionLabelInline}>
                MEU UMIDOR
              </ThemedText>
              <Pressable onPress={() => router.push('/humidor')} hitSlop={8}>
                <ThemedText variant="caption" color="gold">
                  Ver tudo
                </ThemedText>
              </Pressable>
            </View>
            <Pressable style={styles.humidorEmpty} onPress={() => router.push('/humidor')}>
              {humidorTotal === 0 ? (
                <ThemedText variant="body" color="textTertiary" style={styles.humidorEmptyText}>
                  Nenhum charuto registrado ainda
                </ThemedText>
              ) : (
                <ThemedText variant="body" color="textSecondary">
                  {humidorTotal} charuto{humidorTotal === 1 ? '' : 's'} no umidor
                </ThemedText>
              )}
            </Pressable>

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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  trialBadge: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.goldMuted,
    backgroundColor: theme.colors.surfaceElevated,
  },
  trialBadgeText: { fontFamily: theme.fonts.bodySemiBold, letterSpacing: 1, fontSize: 11 },
  statsRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  tasteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  tasteTexts: { flex: 1, marginHorizontal: theme.spacing.sm },
  tasteTitle: { fontFamily: theme.fonts.bodySemiBold },
  sectionLabel: {
    letterSpacing: 1.5,
    fontFamily: theme.fonts.bodySemiBold,
    marginBottom: theme.spacing.sm,
  },
  sectionLabelInline: {
    letterSpacing: 1.5,
    fontFamily: theme.fonts.bodySemiBold,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  achievementCard: {
    width: '31%',
    flexGrow: 1,
    minWidth: '30%',
    maxWidth: '32%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    padding: theme.spacing.sm,
    alignItems: 'center',
    minHeight: 96,
  },
  achievementLocked: { opacity: 0.55 },
  achievementName: { textAlign: 'center', marginTop: 6, marginBottom: 2, fontSize: 11 },
  humidorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  humidorEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.divider,
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  humidorEmptyText: { textAlign: 'center' },
  gridTitle: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
});
