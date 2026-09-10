import { ApiError } from '../api/client';

const DEFAULT_MESSAGE = 'Algo deu errado. Tente novamente em instantes.';

/**
 * Extrai uma mensagem de erro legível em português a partir de um `ApiError`
 * (corpo típico do Nest: `{ message: string | string[] }`) ou de um erro
 * genérico de rede.
 */
export function getErrorMessage(error: unknown, fallback: string = DEFAULT_MESSAGE): string {
  if (error instanceof ApiError) {
    const body = error.body as { message?: string | string[] } | null;
    if (body?.message) {
      return Array.isArray(body.message) ? body.message.join('\n') : body.message;
    }
    if (error.status === 401) return 'Sessão expirada. Faça login novamente.';
    if (error.status === 403) return 'Você não tem permissão para fazer isso.';
    if (error.status === 404) return 'Não encontrado.';
    if (error.status === 0) {
      return 'O servidor gratuito pode estar acordando. Espere um minuto e tente de novo.';
    }
    if (error.status >= 500) return 'Servidor indisponível. Tente novamente mais tarde.';
    return fallback;
  }
  if (error instanceof Error && error.message) {
    if (/network|abort|timeout|failed to fetch/i.test(error.message)) {
      return 'Sem conexão com o servidor. No plano gratuito ele dorme: abra de novo em um minuto.';
    }
    return error.message;
  }
  return fallback;
}
