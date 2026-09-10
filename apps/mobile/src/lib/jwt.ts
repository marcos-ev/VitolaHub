const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

// Decodificador base64 auto-contido (sem depender de `atob`, cuja
// disponibilidade varia entre engines JS do React Native) usado só para ler
// o payload de um JWT — nunca para validar assinatura, que é sempre feita
// pelo backend.
function base64Decode(input: string): string {
  const sanitized = input.replace(/[^A-Za-z0-9+/=]/g, '');
  let output = '';
  let buffer = 0;
  let bits = 0;

  for (const char of sanitized) {
    if (char === '=') break;
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

/**
 * Decodifica (sem verificar) o payload de um JWT. Usado apenas para extrair
 * claims de exibição (ex.: `username`) no cliente — a fonte da verdade e
 * toda validação de autenticidade continuam no backend.
 */
export function decodeJwtPayload<T>(token: string): T | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      base64Decode(normalized)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
