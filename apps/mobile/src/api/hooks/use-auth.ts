import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../client';
import { useAuthStore } from '../../state/auth-store';
import { AuthSession, LoginPayload, RegisterPayload } from '../types';

// POST /auth/login — { identifier, password } -> { accessToken, refreshToken }
export function useLoginMutation() {
  return useMutation({
    mutationFn: (payload: LoginPayload) =>
      apiFetch<AuthSession>('/auth/login', { method: 'POST', body: payload, auth: false }),
    onSuccess: async (session) => {
      await useAuthStore.getState().setTokens(session.accessToken, session.refreshToken);
    },
  });
}

// POST /auth/register — ver RegisterPayload -> { accessToken, refreshToken }
export function useRegisterMutation() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) =>
      apiFetch<AuthSession>('/auth/register', { method: 'POST', body: payload, auth: false }),
    onSuccess: async (session) => {
      await useAuthStore.getState().setTokens(session.accessToken, session.refreshToken);
    },
  });
}

// POST /auth/logout — { refreshToken }
export function useLogoutMutation() {
  return useMutation({
    mutationFn: async () => {
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) {
        await apiFetch('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }).catch(() => undefined);
      }
    },
    onSettled: async () => {
      await useAuthStore.getState().clear();
    },
  });
}
