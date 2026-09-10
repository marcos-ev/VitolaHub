import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { Avatar } from '../../src/components/Avatar';
import { theme } from '../../src/theme';
import {
  usePostQuery,
  usePostCommentsQuery,
  useCreateCommentMutation,
  useReportPostMutation,
  useDeleteCommentMutation,
  useDeletePostMutation,
} from '../../src/api/hooks/use-comments';
import { useToggleLikeMutation } from '../../src/api/hooks/use-feed';
import { PostComment } from '../../src/api/types';
import { getErrorMessage } from '../../src/lib/error-message';
import { useCurrentUserClaims } from '../../src/lib/current-user';
import { CigarCover } from '../../src/components/CigarCover';

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

export default function PostDetailScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const postId = Array.isArray(id) ? id[0] : id;
  const shouldFocus = (Array.isArray(focus) ? focus[0] : focus) === 'comment';
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<PostComment>>(null);

  const postQuery = usePostQuery(postId);
  const commentsQuery = usePostCommentsQuery(postId);
  const claims = useCurrentUserClaims();
  const createComment = useCreateCommentMutation(postId ?? '', {
    id: claims?.sub ?? '',
    username: claims?.username ?? 'voce',
    displayName: 'Você',
    avatarUrl: null,
  });
  const toggleLike = useToggleLikeMutation();
  const reportPost = useReportPostMutation();
  const deleteComment = useDeleteCommentMutation(postId ?? '');
  const deletePost = useDeletePostMutation();
  const [draft, setDraft] = useState('');

  const comments = useMemo(() => {
    const items = commentsQuery.data?.pages.flatMap((page) => page.items) ?? [];
    return [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [commentsQuery.data]);

  useEffect(() => {
    if (!shouldFocus) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [shouldFocus]);

  useEffect(() => {
    if (comments.length === 0) return;
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [comments.length]);

  const handleLike = () => {
    const post = postQuery.data;
    if (!post) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    toggleLike.mutate({ postId: post.id, liked: post.likedByMe });
  };

  const handleReport = () => {
    if (!postId) return;
    Alert.alert('Denunciar publicação', 'A equipe vai revisar este conteúdo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Denunciar',
        style: 'destructive',
        onPress: () =>
          reportPost.mutate(
            { postId, reason: 'Conteúdo impróprio ou spam' },
            {
              onSuccess: () => Alert.alert('Denúncia enviada', 'Obrigado. Vamos analisar esta publicação.'),
              onError: (error) => Alert.alert('Erro', getErrorMessage(error, 'Não foi possível denunciar.')),
            },
          ),
      },
    ]);
  };

  const handleDeletePost = () => {
    if (!postId) return;
    Alert.alert('Excluir publicação', 'Essa foto some do feed. Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          deletePost.mutate(postId, {
            onSuccess: () => router.replace('/(tabs)'),
            onError: (error) => Alert.alert('Erro', getErrorMessage(error, 'Não foi possível excluir.')),
          }),
      },
    ]);
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert('Excluir comentário', 'Remover este comentário?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          deleteComment.mutate(commentId, {
            onError: (error) => Alert.alert('Erro', getErrorMessage(error, 'Não foi possível excluir.')),
          }),
      },
    ]);
  };

  const handleSendComment = () => {
    const body = draft.trim();
    if (!body || !postId || createComment.isPending) return;
    setDraft('');
    createComment.mutate(body, {
      onError: (error) => {
        setDraft(body);
        Alert.alert('Erro', getErrorMessage(error, 'Não foi possível comentar.'));
      },
    });
  };

  if (postQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Publicação" />
        <LoadingState label="Carregando..." />
      </Screen>
    );
  }

  if (postQuery.isError || !postQuery.data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Publicação" />
        <ErrorState message={getErrorMessage(postQuery.error)} onRetry={() => postQuery.refetch()} />
      </Screen>
    );
  }

  const post = postQuery.data;
  const photo = post.media[0];

  const renderComment = ({ item }: { item: PostComment }) => {
    const mine = !!claims?.sub && (item.author.id === claims.sub || item.author.username === claims.username);
    return (
      <Pressable
        style={styles.commentRow}
        onLongPress={mine ? () => handleDeleteComment(item.id) : undefined}
        onPress={() => router.push(`/user/${item.author.username}`)}
      >
        <Avatar uri={item.author.avatarUrl} size={32} />
        <View style={styles.commentBody}>
          <ThemedText variant="body">
            <ThemedText variant="body" style={styles.commentAuthor}>
              {item.author.displayName}
            </ThemedText>
            {'  '}
            {item.body}
          </ThemedText>
          <ThemedText variant="caption" color="textTertiary">
            {timeAgo(item.createdAt)}
            {mine ? '  ·  segure para excluir' : ''}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  const listHeader = (
    <View>
      <Pressable style={styles.authorRow} onPress={() => router.push(`/user/${post.author.username}`)}>
        <Avatar uri={post.author.avatarUrl} size={36} />
        <View style={styles.authorTexts}>
          <ThemedText variant="body" style={styles.authorName}>
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
      </Pressable>

      <View style={styles.photo}>
        <CigarCover url={photo?.url} brand={post.cigar?.brand.name} name={post.cigar?.name} style={styles.photoFill} />
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.action} onPress={handleLike} hitSlop={8}>
          <Ionicons
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={24}
            color={post.likedByMe ? theme.colors.alert : theme.colors.textSecondary}
          />
        </Pressable>
        <Pressable style={styles.action} onPress={() => inputRef.current?.focus()} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={22} color={theme.colors.textSecondary} />
        </Pressable>
        <ThemedText variant="caption" style={styles.likeCount}>
          {post.likeCount} curtida{post.likeCount === 1 ? '' : 's'}
        </ThemedText>
      </View>

      {post.body ? (
        <ThemedText variant="body" style={styles.caption}>
          <ThemedText variant="body" style={styles.commentAuthor}>
            {post.author.displayName}
          </ThemedText>
          {'  '}
          {post.body}
        </ThemedText>
      ) : null}

      {post.cigar ? (
        <Pressable style={styles.cigarChip} onPress={() => router.push(`/cigar/${post.cigar!.id}`)}>
          <Ionicons name="leaf-outline" size={16} color={theme.colors.gold} />
          <ThemedText variant="caption" style={styles.cigarChipText}>
            Ver charuto · Avaliar
          </ThemedText>
          {post.review ? (
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={10} color={theme.colors.background} />
              <ThemedText variant="caption" style={styles.ratingPillText}>
                {post.review.rating.toFixed(1)}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      <ThemedText variant="caption" color="textTertiary" style={styles.commentsLabel}>
        {comments.length > 0 ? `Comentários · ${comments.length}` : 'Seja o primeiro a comentar'}
      </ThemedText>
    </View>
  );

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerPad}>
        <ScreenHeader
          title="Publicação"
          right={
            claims?.sub === post.author.id ? (
              <Pressable onPress={handleDeletePost} hitSlop={10} accessibilityLabel="Excluir publicação">
                <Ionicons name="trash-outline" size={22} color={theme.colors.alert} />
              </Pressable>
            ) : (
              <Pressable onPress={handleReport} hitSlop={10} accessibilityLabel="Denunciar publicação">
                <Ionicons name="flag-outline" size={22} color={theme.colors.textSecondary} />
              </Pressable>
            )
          }
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          ref={listRef}
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => {
            if (commentsQuery.hasNextPage && !commentsQuery.isFetchingNextPage) {
              commentsQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={commentsQuery.isFetchingNextPage ? <LoadingState /> : null}
          showsVerticalScrollIndicator={false}
        />

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder="Escreva um comentário..."
            placeholderTextColor={theme.colors.textTertiary}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSendComment}
            style={styles.composerInput}
          />
          <Pressable
            onPress={handleSendComment}
            disabled={!draft.trim() || createComment.isPending}
            hitSlop={8}
            style={[styles.sendButton, draft.trim() ? styles.sendButtonOn : null]}
            accessibilityLabel="Publicar comentário"
          >
            <ThemedText variant="body" color={draft.trim() ? 'background' : 'textTertiary'} style={styles.sendLabel}>
              {createComment.isPending ? '...' : 'Enviar'}
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerPad: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm },
  listContent: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  authorTexts: { flex: 1, marginLeft: theme.spacing.sm },
  authorName: { fontFamily: theme.fonts.bodySemiBold },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surfaceElevated,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  photoFill: { width: '100%', height: '100%' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xs },
  action: { marginRight: theme.spacing.md },
  likeCount: { fontFamily: theme.fonts.bodySemiBold },
  caption: { marginBottom: theme.spacing.sm },
  commentAuthor: { fontFamily: theme.fonts.bodySemiBold },
  cigarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  cigarChipText: { color: theme.colors.gold },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gold,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: theme.spacing.xs,
  },
  ratingPillText: { color: theme.colors.background, marginLeft: 2, fontSize: 11 },
  commentsLabel: { marginBottom: theme.spacing.sm },
  commentRow: { flexDirection: 'row', marginBottom: theme.spacing.md },
  commentBody: { flex: 1, marginLeft: theme.spacing.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.sm,
  },
  composerInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 100,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  sendButton: {
    minHeight: 48,
    minWidth: 72,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  sendButtonOn: { backgroundColor: theme.colors.gold },
  sendLabel: { fontFamily: theme.fonts.bodySemiBold },
});
