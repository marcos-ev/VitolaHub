import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';
import { NotificationItem, NotificationsPage } from '../types';

// GET /notifications — paginação por cursor, { items, nextCursor }.
export function useNotificationsQuery() {
  return useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const cursorParam = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : '';
      return apiFetch<NotificationsPage>(`/notifications${cursorParam}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 15_000,
  });
}

// Usado apenas para acender o marcador (badge) do sino no header de outras
// telas — reaproveita a primeira página do cache de notificações.
export function useHasUnreadNotifications() {
  const { data } = useQuery({
    queryKey: ['notifications', 'firstPage'],
    queryFn: () => apiFetch<NotificationsPage>('/notifications'),
    staleTime: 15_000,
  });
  return data?.items.some((item) => !item.readAt) ?? false;
}

type NotificationPages = { pages: NotificationsPage[]; pageParams: unknown[] };

/**
 * SUPOSIÇÃO: a lista de endpoints fornecida não inclui uma rota explícita
 * para marcar notificação como lida. Assumimos `POST /notifications/:id/read`
 * (sem corpo). A UI já atualiza o estado local otimisticamente, então, se o
 * endpoint não existir ainda, a experiência visual continua funcionando —
 * só o estado "lido" não persiste entre sessões até o backend implementar.
 */
export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiFetch(`/notifications/${notificationId}/read`, { method: 'POST' }).catch(() => undefined),
    onMutate: async (notificationId: string) => {
      const now = new Date().toISOString();
      queryClient.setQueriesData<NotificationPages>({ queryKey: ['notifications'] }, (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item: NotificationItem) =>
              item.id === notificationId && !item.readAt ? { ...item, readAt: now } : item,
            ),
          })),
        };
      });
    },
  });
}
