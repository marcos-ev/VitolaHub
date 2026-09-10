import { useAuthStore } from '../state/auth-store';

// Vite expõe variáveis prefixadas com VITE_ ao bundle do cliente via
// import.meta.env (equivalente ao EXPO_PUBLIC_* usado no app mobile).
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`Erro de API (${status})`);
  }
}

let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) throw new ApiError(401, null);

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clear();
    throw new ApiError(response.status, await response.json().catch(() => null));
  }

  const data = (await response.json()) as { accessToken: string; refreshToken: string };
  setTokens(data.accessToken, data.refreshToken);
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean; // default true
}

/**
 * Cliente HTTP único do painel. Espelha `apps/mobile/src/api/client.ts`:
 * renova a sessão automaticamente em um 401 (o backend é sempre a fonte da
 * verdade — seção 6.4) e repete a requisição original uma vez, trocando só
 * o armazenamento (localStorage em vez de SecureStore).
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;

  const doFetch = async (): Promise<Response> => {
    const token = useAuthStore.getState().accessToken;
    return fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await doFetch();

  if (response.status === 401 && auth) {
    refreshPromise ??= refreshSession().finally(() => {
      refreshPromise = null;
    });
    await refreshPromise;
    response = await doFetch();
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
