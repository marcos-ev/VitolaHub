import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CursorPage } from '@charuto/shared';
import { apiFetch } from '../client';
import { PostComment, PostSummaryExt } from '../types';

type CommentPages = { pages: CursorPage<PostComment>[]; pageParams: unknown[] };

export function useReportPostMutation() {
  return useMutation({
    mutationFn: ({ postId, reason }: { postId: string; reason: string }) =>
      apiFetch(`/posts/${postId}/report`, { method: 'POST', body: { reason } }),
  });
}

export function usePostQuery(postId: string | undefined) {
  return useQuery({
    queryKey: ['post', postId],
    queryFn: () => apiFetch<PostSummaryExt>(`/posts/${postId}`),
    enabled: !!postId,
  });
}

export function usePostCommentsQuery(postId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['postComments', postId],
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const cursorParam = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : '';
      return apiFetch<CursorPage<PostComment>>(`/posts/${postId}/comments${cursorParam}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!postId,
  });
}

function bumpCommentCountInFeeds(queryClient: ReturnType<typeof useQueryClient>, postId: string, delta: number) {
  queryClient.setQueryData<PostSummaryExt>(['post', postId], (post) =>
    post ? { ...post, commentCount: Math.max(0, post.commentCount + delta) } : post,
  );

  const patchPages = (data: { pages: CursorPage<PostSummaryExt>[]; pageParams: unknown[] } | undefined) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((item) =>
          item.id === postId ? { ...item, commentCount: Math.max(0, item.commentCount + delta) } : item,
        ),
      })),
    };
  };

  queryClient.setQueriesData({ queryKey: ['feed'] }, patchPages);
  queryClient.setQueriesData({ queryKey: ['userPosts'] }, patchPages);
  queryClient.setQueriesData({ queryKey: ['explore', 'posts'] }, patchPages);
}

export function useDeleteCommentMutation(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      apiFetch<void>(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postComments', postId] });
      bumpCommentCountInFeeds(queryClient, postId, -1);
    },
  });
}

export function useDeletePostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => apiFetch<void>(`/posts/${postId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: ['explore', 'posts'] });
    },
  });
}

function prependComment(data: CommentPages | undefined, comment: PostComment): CommentPages {
  if (!data?.pages?.length) {
    return { pages: [{ items: [comment], nextCursor: null }], pageParams: [null] };
  }
  const [first, ...rest] = data.pages;
  return { ...data, pages: [{ ...first, items: [comment, ...first.items] }, ...rest] };
}

export function useCreateCommentMutation(postId: string, author?: PostComment['author']) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<PostComment>(`/posts/${postId}/comments`, { method: 'POST', body: { body } }),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: ['postComments', postId] });
      const previous = queryClient.getQueryData<CommentPages>(['postComments', postId]);

      const optimistic: PostComment = {
        id: `optimistic-${Date.now()}`,
        body,
        createdAt: new Date().toISOString(),
        author: author ?? { id: '', username: 'voce', displayName: 'Você', avatarUrl: null },
      };

      queryClient.setQueryData<CommentPages>(['postComments', postId], (data) => prependComment(data, optimistic));
      bumpCommentCountInFeeds(queryClient, postId, 1);
      return { previous };
    },
    onError: (_error, _body, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['postComments', postId], context.previous);
      }
      bumpCommentCountInFeeds(queryClient, postId, -1);
    },
    onSuccess: (comment) => {
      queryClient.setQueryData<CommentPages>(['postComments', postId], (data) => {
        if (!data?.pages[0]) return prependComment(data, comment);
        const [first, ...rest] = data.pages;
        const replaced = first.items.some((item) => item.id.startsWith('optimistic-'));
        return {
          ...data,
          pages: [
            {
              ...first,
              items: replaced
                ? first.items.map((item) => (item.id.startsWith('optimistic-') ? comment : item))
                : [comment, ...first.items],
            },
            ...rest,
          ],
        };
      });
    },
  });
}
