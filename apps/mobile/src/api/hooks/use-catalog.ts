import { useMutation, useQuery } from '@tanstack/react-query';
import { CursorPage } from '@charuto/shared';
import { apiFetch } from '../client';
import { CigarDetail, CigarSearchItem, SuggestCigarPayload } from '../types';

// GET /catalog/cigars/search?q= — busca com debounce feita pelo chamador
// (ver app/review/new.tsx), aqui só desabilitamos a query com menos de 2
// caracteres (mesma regra de validação do backend).
export function useCigarSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['catalog', 'search', trimmed],
    queryFn: () => apiFetch<CursorPage<CigarSearchItem>>(`/catalog/cigars/search?q=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length >= 2,
    staleTime: 15_000,
  });
}

// GET /catalog/cigars/:id
export function useCigarDetail(cigarId: string | undefined) {
  return useQuery({
    queryKey: ['catalog', 'cigar', cigarId],
    queryFn: () => apiFetch<CigarDetail>(`/catalog/cigars/${cigarId}`),
    enabled: !!cigarId,
  });
}

// POST /catalog/cigars/suggest
export function useSuggestCigar() {
  return useMutation({
    mutationFn: (payload: SuggestCigarPayload) =>
      apiFetch<CigarDetail>('/catalog/cigars/suggest', { method: 'POST', body: payload }),
  });
}
