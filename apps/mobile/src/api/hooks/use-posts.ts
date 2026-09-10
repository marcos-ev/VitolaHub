import { useInfiniteQuery } from '@tanstack/react-query';
import { CursorPage } from '@charuto/shared';
import { apiFetch } from '../client';
import { PostSummaryExt } from '../types';

// SUPOSIÇÃO: não há, na lista de endpoints fornecida, uma rota específica
// para "posts de um usuário" (usada na grade do perfil). Assumimos
// `GET /posts?authorId=:id&cursor=` seguindo a mesma convenção de paginação
// por cursor do resto da API. Ajustar aqui se o backend expuser outra rota
// (ex.: `GET /users/:id/posts`).
export function useUserPostsQuery(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['userPosts', userId],
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const params = new URLSearchParams({ authorId: userId! });
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<CursorPage<PostSummaryExt>>(`/posts?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!userId,
  });
}
