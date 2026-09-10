import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CursorPage, PublicUser } from '@charuto/shared';
import { apiFetch } from '../client';
import { PostSummaryExt } from '../types';

// Busca de pessoas por username/nome (`GET /users/search?q=`).
export function usePeopleSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['explore', 'peopleSearch', trimmed],
    queryFn: () => apiFetch<PublicUser[]>(`/users/search?q=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length >= 2,
  });
}

// "Pessoas sugeridas" (`GET /users/suggested`) — perfis populares que o
// usuário ainda não segue.
export function useSuggestedPeople() {
  return useQuery({
    queryKey: ['explore', 'suggestedPeople'],
    queryFn: () => apiFetch<PublicUser[]>('/users/suggested'),
  });
}

// Posts públicos recentes de toda a base (`GET /posts?visibility=PUBLIC`),
// mesma convenção de paginação por cursor usada em `use-posts.ts`.
export function useExplorePostsQuery() {
  return useInfiniteQuery({
    queryKey: ['explore', 'posts'],
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const params = new URLSearchParams({ visibility: 'PUBLIC' });
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<CursorPage<PostSummaryExt>>(`/posts?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 15_000,
  });
}
