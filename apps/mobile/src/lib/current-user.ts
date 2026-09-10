import { useAuthStore } from '../state/auth-store';
import { decodeJwtPayload } from './jwt';

interface AccessTokenClaims {
  sub: string;
  username: string;
}

/**
 * Não existe endpoint `GET /users/me` no contrato atual — só
 * `GET /users/:username`. Para saber "quem sou eu" sem esperar por esse
 * endpoint, decodificamos (sem verificar assinatura) as claims `sub`
 * (id) e `username` do próprio access token, que o backend já inclui
 * (ver AuthService.issueSession). Isso é só para navegação/exibição no
 * cliente; qualquer ação sensível continua validada pelo backend via o
 * token de verdade enviado no header Authorization.
 */
export function useCurrentUserClaims(): AccessTokenClaims | null {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return null;
  return decodeJwtPayload<AccessTokenClaims>(accessToken);
}
