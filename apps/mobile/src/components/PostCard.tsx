import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { theme } from '../theme';
import { PostSummaryExt } from '../api/types';
import { Avatar } from './Avatar';
import { ThemedText } from './ThemedText';
import { CigarCover } from './CigarCover';

interface PostCardProps {
  post: PostSummaryExt;
  onToggleLike: () => void;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

// O card do feed (seção 7.2): a foto é o elemento principal, o resto da
// interface existe só para emoldurá-la.
export function PostCard({ post, onToggleLike }: PostCardProps) {
  const photo = post.media[0];

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onToggleLike();
  };

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => router.push(`/user/${post.author.username}`)}>
        <Avatar uri={post.author.avatarUrl} size={36} />
        <View style={styles.headerTexts}>
          <ThemedText variant="body" style={styles.authorName} numberOfLines={1}>
            {post.author.displayName}
          </ThemedText>
          {post.cigar ? (
            <ThemedText variant="caption" numberOfLines={1}>
              {post.cigar.brand.name} {post.cigar.name}
            </ThemedText>
          ) : (
            <ThemedText variant="caption">@{post.author.username}</ThemedText>
          )}
        </View>
        <ThemedText variant="caption">{timeAgo(post.createdAt)}</ThemedText>
      </Pressable>

      {photo ? (
        <Pressable onPress={() => router.push(`/post/${post.id}`)} style={styles.photoWrapper}>
          <CigarCover url={photo.url} brand={post.cigar?.brand.name} name={post.cigar?.name} style={styles.photo} />
          {post.review ? (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color={theme.colors.background} />
              <ThemedText variant="caption" style={styles.ratingBadgeText}>
                {post.review.rating.toFixed(1)}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      ) : (
        <Pressable onPress={() => router.push(`/post/${post.id}`)} style={styles.photoWrapper}>
          <CigarCover brand={post.cigar?.brand.name} name={post.cigar?.name} style={styles.photo} />
        </Pressable>
      )}

      {post.body ? (
        <ThemedText variant="body" style={styles.body}>
          {post.body}
        </ThemedText>
      ) : null}

      <View style={styles.footer}>
        <Pressable style={styles.footerAction} onPress={handleLike} hitSlop={8}>
          <Ionicons
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={22}
            color={post.likedByMe ? theme.colors.alert : theme.colors.textSecondary}
          />
          <ThemedText variant="caption" style={styles.footerCount}>
            {post.likeCount}
          </ThemedText>
        </Pressable>
        <Pressable
          style={styles.footerAction}
          onPress={() => router.push(`/post/${post.id}?focus=comment`)}
          hitSlop={8}
        >
          <Ionicons name="chatbubble-outline" size={20} color={theme.colors.textSecondary} />
          <ThemedText variant="caption" style={styles.footerCount}>
            {post.commentCount}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    ...theme.shadow.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  headerTexts: { flex: 1, marginLeft: theme.spacing.sm, marginRight: theme.spacing.sm },
  authorName: { fontFamily: theme.fonts.bodySemiBold },
  photoWrapper: { width: '100%', aspectRatio: 1, overflow: 'hidden' },
  photo: { width: '100%', height: '100%', backgroundColor: theme.colors.surfaceElevated },
  ratingBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gold,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  ratingBadgeText: { color: theme.colors.background, fontFamily: theme.fonts.bodySemiBold, marginLeft: 4 },
  body: { padding: theme.spacing.md, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  footerAction: { flexDirection: 'row', alignItems: 'center', marginRight: theme.spacing.lg },
  footerCount: { marginLeft: theme.spacing.xs },
});
