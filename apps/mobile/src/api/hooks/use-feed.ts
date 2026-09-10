import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CursorPage } from '@charuto/shared';
import { apiFetch } from '../client';
import { PostSummaryExt } from '../types';

export type FeedTab = 'forYou' | 'following';

const FEED_ENDPOINT: Record<FeedTab, string> = {
  forYou: '/feed/for-you',
  following: '/feed/following',
};

type FeedPages = { pages: CursorPage<PostSummaryExt>[]; pageParams: unknown[] };

// GET /feed/for-you e GET /feed/following — paginação por cursor,
// { items, nextCursor }.
export function useFeedQuery(tab: FeedTab) {
  return useInfiniteQuery({
    queryKey: ['feed', tab],
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const cursorParam = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : '';
      return apiFetch<CursorPage<PostSummaryExt>>(`${FEED_ENDPOINT[tab]}${cursorParam}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

function toggleLikeInPages(data: FeedPages | undefined, postId: string, liked: boolean): FeedPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((post) =>
        post.id === postId
          ? { ...post, likedByMe: !liked, likeCount: Math.max(0, post.likeCount + (liked ? -1 : 1)) }
          : post,
      ),
    })),
  };
}

/**
 * Curtir/descurtir com atualização otimista local (curtidas somem/aparecem
 * imediatamente, sem esperar a resposta da API). `POST /posts/:id/like` é
 * confirmado pela especificação; `DELETE /posts/:id/like` para descurtir é
 * uma SUPOSIÇÃO (segue o mesmo padrão REST usado em `/users/:id/follow`
 * neste mesmo backend), documentada no resumo final do agente.
 */
export function useToggleLikeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      liked
        ? apiFetch(`/posts/${postId}/like`, { method: 'DELETE' })
        : apiFetch(`/posts/${postId}/like`, { method: 'POST' }),
    onMutate: async ({ postId, liked }) => {
      queryClient.setQueriesData<FeedPages>({ queryKey: ['feed'] }, (data) => toggleLikeInPages(data, postId, liked));
      queryClient.setQueriesData<FeedPages>({ queryKey: ['userPosts'] }, (data) =>
        toggleLikeInPages(data, postId, liked),
      );
      queryClient.setQueryData<PostSummaryExt>(['post', postId], (post) =>
        post
          ? { ...post, likedByMe: !liked, likeCount: Math.max(0, post.likeCount + (liked ? -1 : 1)) }
          : post,
      );
    },
  });
}
