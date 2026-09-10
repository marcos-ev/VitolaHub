import { useAuthStore } from '../state/auth-store';
import { demoApiRouter, isDemoMode } from '../demo';
import { ApiError } from './errors';

// SDK 51+ expõe variáveis EXPO_PUBLIC_* automaticamente ao bundle do cliente.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
export const DEMO_MODE_ENABLED = isDemoMode();

export { ApiError } from './errors';

/** Render Free / Neon Free dormem. O wake pode levar ~1 minuto. */
const FETCH_TIMEOUT_MS = 90_000;
const NETWORK_ATTEMPTS = 2;

let refreshPromise: Promise<void> | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNetworkError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const aborted = error instanceof Error && (error.name === 'AbortError' || /aborted|timeout/i.test(error.message));
  return new ApiError(0, {
    message: aborted
      ? 'O servidor gratuito está acordando. Isso pode levar até um minuto; tente de novo em instantes.'
      : 'Sem conexão com o servidor. Confira a internet ou tente de novo em instantes.',
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const parentSignal = init.signal;
  const onAbort = () => controller.abort();
  parentSignal?.addEventListener('abort', onAbort);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw toNetworkError(error);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onAbort);
  }
}

function shouldRetry(error: unknown, status?: number) {
  if (typeof status === 'number') return status === 0 || status === 502 || status === 503 || status === 504;
  return error instanceof ApiError && (error.status === 0 || error.status >= 500);
}

/** Acorda API + Postgres gratuitos que dormiram. Falha não bloqueia o app. */
export async function wakeApi(): Promise<void> {
  if (isDemoMode()) return;
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/health`, { method: 'GET' });
    if (response.ok) return;
  } catch {
    // queries seguintes tentam de novo
  }
}

async function refreshSession(): Promise<void> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) throw new ApiError(401, null);

  if (isDemoMode()) {
    const data = await demoApiRouter<{ accessToken: string; refreshToken: string }>({
      path: '/auth/refresh',
      method: 'POST',
      body: { refreshToken },
    });
    await setTokens(data.accessToken, data.refreshToken);
    return;
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    await clear();
    throw new ApiError(response.status, await response.json().catch(() => null));
  }

  const data = (await response.json()) as { accessToken: string; refreshToken: string };
  await setTokens(data.accessToken, data.refreshToken);
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean; // default true
}

/**
 * Cliente HTTP único do app. Renova a sessão automaticamente em um 401
 * (o backend é sempre a fonte da verdade — seção 6.4 — o cliente só reflete
 * o token que ele emite) e repete a requisição original uma vez.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, headers, method = 'GET', ...rest } = options;

  if (isDemoMode()) {
    return demoApiRouter<T>({ path, method, body });
  }

  const doFetch = async (): Promise<Response> => {
    const token = useAuthStore.getState().accessToken;
    let lastError: unknown;
    for (let attempt = 0; attempt < NETWORK_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
          ...rest,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (shouldRetry(undefined, response.status) && attempt < NETWORK_ATTEMPTS - 1) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (!shouldRetry(error) || attempt === NETWORK_ATTEMPTS - 1) throw error;
        await sleep(2000 * (attempt + 1));
      }
    }
    throw lastError instanceof Error ? lastError : toNetworkError(lastError);
  };

  let response = await doFetch();

  if (response.status === 401 && auth) {
    try {
      refreshPromise ??= refreshSession().finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
      response = await doFetch();
    } catch {
      // Refresh falhou (token inválido/expirado/bug no servidor): limpa a
      // sessão para o layout mandar o usuário de volta ao login, em vez de
      // ficar na tela genérica "Algo deu errado".
      await useAuthStore.getState().clear();
      throw new ApiError(401, { message: 'Sessão expirada. Faça login novamente.' });
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
