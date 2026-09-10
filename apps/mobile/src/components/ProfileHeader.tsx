import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PublicUser } from '@charuto/shared';
import { theme } from '../theme';
import { Avatar } from './Avatar';
import { ThemedText } from './ThemedText';

interface ProfileHeaderProps {
  user: PublicUser;
  onAvatarPress?: () => void;
  avatarUploading?: boolean;
  onPressFollowers?: () => void;
  onPressFollowing?: () => void;
  rightActions?: ReactNode;
}

export function ProfileHeader({
  user,
  onAvatarPress,
  avatarUploading,
  onPressFollowers,
  onPressFollowing,
  rightActions,
}: ProfileHeaderProps) {
  return (
    <View>
      <View style={styles.topRow}>
        <Pressable onPress={onAvatarPress} disabled={!onAvatarPress}>
          <Avatar uri={user.avatarUrl} size={84} />
          {onAvatarPress ? (
            <View style={styles.avatarBadge}>
              {avatarUploading ? (
                <ActivityIndicator size="small" color={theme.colors.background} />
              ) : (
                <Ionicons name="camera" size={14} color={theme.colors.background} />
              )}
            </View>
          ) : null}
        </Pressable>

        <View style={styles.counters}>
          <Pressable style={styles.counterItem} onPress={onPressFollowers} disabled={!onPressFollowers}>
            <ThemedText variant="title">{user.followerCount}</ThemedText>
            <ThemedText variant="caption">Seguidores</ThemedText>
          </Pressable>
          <Pressable style={styles.counterItem} onPress={onPressFollowing} disabled={!onPressFollowing}>
            <ThemedText variant="title">{user.followingCount}</ThemedText>
            <ThemedText variant="caption">Seguindo</ThemedText>
          </Pressable>
          <View style={styles.counterItem}>
            <ThemedText variant="title">{user.friendCount}</ThemedText>
            <ThemedText variant="caption">Amigos</ThemedText>
          </View>
        </View>
      </View>

      <ThemedText variant="title" style={styles.name}>
        {user.displayName}
      </ThemedText>
      <View style={styles.usernameRow}>
        <ThemedText variant="caption">@{user.username}</ThemedText>
        {user.accountType === 'PJ' ? (
          <View style={styles.shopBadge}>
            <Ionicons name="storefront-outline" size={11} color={theme.colors.gold} />
            <ThemedText variant="caption" style={styles.shopBadgeText}>
              Lojista
            </ThemedText>
          </View>
        ) : null}
      </View>
      {user.bio ? (
        <ThemedText variant="body" style={styles.bio}>
          {user.bio}
        </ThemedText>
      ) : null}
      {user.city || user.state ? (
        <ThemedText variant="caption" style={styles.location}>
          {[user.city, user.state].filter(Boolean).join(', ')}
        </ThemedText>
      ) : null}

      {rightActions ? <View style={styles.actions}>{rightActions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  counters: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: theme.spacing.md },
  counterItem: { alignItems: 'center' },
  name: { marginTop: theme.spacing.sm },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: 2 },
  shopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    gap: 4,
  },
  shopBadgeText: { color: theme.colors.gold, fontSize: 11 },
  bio: { marginTop: theme.spacing.sm },
  location: { marginTop: theme.spacing.xs },
  actions: { flexDirection: 'row', marginTop: theme.spacing.md },
});
