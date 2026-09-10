import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiFetch, API_BASE_URL } from '../client';
import { useAuthStore } from '../../state/auth-store';
import { CompareResponse, ReviewHistoryPage, TasteProfileResponse } from '../types';

// GET /stats/taste-profile — painel de estatísticas do paladar (seção 5.8),
// protegido pela feature TASTE_STATS.
export function useTasteProfile() {
  return useQuery({
    queryKey: ['stats', 'taste-profile'],
    queryFn: () => apiFetch<TasteProfileResponse>('/stats/taste-profile'),
  });
}

// GET /stats/history — histórico completo de avaliações, paginado por
// cursor. Usuários sem REVIEW_HISTORY_FULL recebem `historyLimitedToDays`
// preenchido (90) e só enxergam os últimos dias correspondentes (o backend
// já aplica esse corte; o cliente só exibe o aviso).
export function useReviewHistory() {
  return useInfiniteQuery({
    queryKey: ['stats', 'history'],
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set('cursor', pageParam);
      const query = params.toString();
      return apiFetch<ReviewHistoryPage>(`/stats/history${query ? `?${query}` : ''}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

// GET /stats/compare?cigarIds=id1,id2,... — protegido pela feature
// COMPARE_CIGARS. Habilitado somente com 2 a 4 charutos selecionados.
export function useCompareCigars(cigarIds: string[]) {
  return useQuery({
    queryKey: ['stats', 'compare', cigarIds],
    queryFn: () => apiFetch<CompareResponse>(`/stats/compare?cigarIds=${cigarIds.join(',')}`),
    enabled: cigarIds.length >= 2,
  });
}

// GET /stats/export?format=csv|pdf — protegido pela feature EXPORT_CSV_PDF.
// O endpoint devolve o arquivo cru (text/csv ou text/html), não JSON, então
// não passa por `apiFetch` (que sempre faz `.json()`); em vez de um hook de
// query, devolvemos a URL + headers já montados para `FileSystem.downloadAsync`
// (chamado sob demanda a partir de Configurações).
export function getStatsExportRequest(format: 'csv' | 'pdf' = 'csv'): {
  url: string;
  headers: Record<string, string>;
  filename: string;
} {
  const token = useAuthStore.getState().accessToken;
  return {
    url: `${API_BASE_URL}/stats/export?format=${format}`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    filename: format === 'csv' ? 'avaliacoes.csv' : 'avaliacoes.html',
  };
}
