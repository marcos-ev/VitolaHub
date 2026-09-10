import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PublicUser } from '@charuto/shared';
import { apiFetch } from '../client';
import { FollowEdgeRaw } from '../types';

// GET /users/:username
export function useUserProfileQuery(username: string | undefined) {
  return useQuery({
    queryKey: ['user', username],
    queryFn: () => apiFetch<PublicUser>(`/users/${username}`),
    enabled: !!username,
  });
}

// PATCH /users/me
export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<PublicUser, 'displayName' | 'bio' | 'city' | 'state' | 'avatarUrl'>>) =>
      apiFetch<PublicUser>('/users/me', { method: 'PATCH', body: patch }),
    onSuccess: (user) => {
      queryClient.setQueryData(['user', user.username], user);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// DELETE /users/me — encerra a conta e invalida a sessão no servidor.
export function useDeleteAccountMutation() {
  return useMutation({
    mutationFn: () => apiFetch<void>('/users/me', { method: 'DELETE' }),
  });
}

// PATCH /users/me/privacy — { isPrivate }
export function useUpdatePrivacyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isPrivate: boolean) =>
      apiFetch<PublicUser>('/users/me/privacy', { method: 'PATCH', body: { isPrivate } }),
    onSuccess: (user) => {
      queryClient.setQueryData(['user', user.username], user);
    },
  });
}

function invalidateUser(queryClient: ReturnType<typeof useQueryClient>, username?: string) {
  if (username) queryClient.invalidateQueries({ queryKey: ['user', username] });
  queryClient.invalidateQueries({ queryKey: ['followRequests'] });
}

// POST /users/:id/follow — segue direto (perfil aberto) ou solicita (fechado)
export function useFollowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId }: { userId: string; username?: string }) =>
      apiFetch(`/users/${userId}/follow`, { method: 'POST' }),
    onSuccess: (_data, variables) => invalidateUser(queryClient, variables.username),
  });
}

// DELETE /users/:id/follow — deixa de seguir ou cancela solicitação pendente
export function useUnfollowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId }: { userId: string; username?: string }) =>
      apiFetch(`/users/${userId}/follow`, { method: 'DELETE' }),
    onSuccess: (_data, variables) => invalidateUser(queryClient, variables.username),
  });
}

// POST /users/:id/accept — aceita solicitação de quem pediu para me seguir
export function useAcceptFollowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (followerId: string) => apiFetch(`/users/${followerId}/accept`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['followRequests'] }),
  });
}

// POST /users/:id/reject
export function useRejectFollowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (followerId: string) => apiFetch(`/users/${followerId}/reject`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['followRequests'] }),
  });
}

// POST /users/:id/block
export function useBlockUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId }: { userId: string; username?: string }) =>
      apiFetch(`/users/${userId}/block`, { method: 'POST' }),
    onSuccess: (_data, variables) => invalidateUser(queryClient, variables.username),
  });
}

// POST /users/:id/report — { reason }
export function useReportUserMutation() {
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      apiFetch(`/users/${userId}/report`, { method: 'POST', body: { reason } }),
  });
}

// POST /users/:id/unblock
export function useUnblockUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiFetch(`/users/${userId}/unblock`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blockedUsers'] }),
  });
}

// GET /users/me/follow-requests — usado para mostrar o banner "Aceitar
// solicitação" no perfil de terceiros e numa futura tela dedicada.
export function useFollowRequestsQuery() {
  return useQuery({
    queryKey: ['followRequests'],
    queryFn: async () => {
      const raw = await apiFetch<unknown>('/users/me/follow-requests');
      return normalizeUserList(raw, 'follower');
    },
  });
}

/**
 * O backend hoje (FollowsService.listFollowers/listFollowing) devolve um
 * array cru de linhas `Follow` com o usuário do Prisma aninhado em
 * `follower`/`followee` — não `CursorPage<PublicUser>` como o restante da
 * API, e sem paginação. Esta normalização tolera as duas formas (a atual e a
 * que seria consistente com o resto do contrato), então a tela não quebra
 * quando o backend for ajustado.
 */
function normalizeUserList(raw: unknown, edgeKey: 'follower' | 'followee'): PublicUser[] {
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown[] }).items)
      ? (raw as { items: unknown[] }).items
      : [];

  return rows.map((row) => {
    const edge = row as FollowEdgeRaw;
    const nested = (edge[edgeKey] ?? edge.follower ?? edge.followee ?? edge) as Record<string, unknown>;
    return {
      id: String(nested.id ?? ''),
      username: String(nested.username ?? ''),
      displayName: String(nested.displayName ?? nested.username ?? ''),
      avatarUrl: (nested.avatarUrl as string | null) ?? null,
      bio: (nested.bio as string | null) ?? null,
      city: (nested.city as string | null) ?? null,
      state: (nested.state as string | null) ?? null,
      isPrivate: Boolean(nested.isPrivate),
      accountType: (nested.accountType as PublicUser['accountType']) ?? 'PF',
      followerCount: Number(nested.followerCount ?? 0),
      followingCount: Number(nested.followingCount ?? 0),
      friendCount: Number(nested.friendCount ?? 0),
      isFollowedByMe: (nested.isFollowedByMe as PublicUser['isFollowedByMe']) ?? null,
      isFriendWithMe: Boolean(nested.isFriendWithMe),
    } satisfies PublicUser;
  });
}

// GET /users/:id/followers
export function useFollowersQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ['followers', userId],
    queryFn: async () => normalizeUserList(await apiFetch<unknown>(`/users/${userId}/followers`), 'follower'),
    enabled: !!userId,
  });
}

// GET /users/:id/following
export function useFollowingQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ['following', userId],
    queryFn: async () => normalizeUserList(await apiFetch<unknown>(`/users/${userId}/following`), 'followee'),
    enabled: !!userId,
  });
}

// SUPOSIÇÃO: não há, na lista de endpoints fornecida, uma rota para listar
// usuários bloqueados. Assumimos `GET /users/me/blocked`. Se o endpoint não
// existir ainda (404/qualquer erro), a tela trata graciosamente mostrando
// lista vazia em vez de um erro — ver app/settings/blocked.tsx.
export function useBlockedUsersQuery() {
  return useQuery({
    queryKey: ['blockedUsers'],
    queryFn: async () => normalizeUserList(await apiFetch<unknown>('/users/me/blocked'), 'followee'),
    retry: false,
  });
}
