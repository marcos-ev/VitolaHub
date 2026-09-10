import type { AuthTokens } from '@charuto/shared';
import { apiFetch } from './client';

export interface LoginPayload {
  email: string;
  password: string;
}

// Contrato confirmado em `apps/api/src/auth/auth.controller.ts` +
// `auth.service.ts` (POST /api/v1/auth/login) — não é suposição, é o mesmo
// endpoint de login já usado pelo app mobile. O dono da charutaria é um
// `User` comum com `accountType=PJ`, sem rota de login separada.
export function login(payload: LoginPayload): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/login', { method: 'POST', body: payload, auth: false });
}
