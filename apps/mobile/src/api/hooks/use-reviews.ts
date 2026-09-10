import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import { CreatePostPayload, PostSummaryExt } from '../types';

// SUPOSIÇÃO (documentada em detalhe em src/api/types.ts): publica a avaliação
// chamando `POST /posts` com os dados da review embutidos em `review`. Se o
// backend definitivo preferir `POST /reviews` separado, trocar aqui.
export function useCreateReviewPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePostPayload) => apiFetch<PostSummaryExt>('/posts', { method: 'POST', body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: ['explore', 'posts'] });
    },
  });
}
