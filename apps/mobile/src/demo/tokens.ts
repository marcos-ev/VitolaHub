const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64UrlEncode(input: string): string {
  let output = '';
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < input.length; i++) {
    buffer = (buffer << 8) | input.charCodeAt(i);
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      output += BASE64_CHARS[(buffer >> bits) & 0x3f];
    }
  }

  if (bits > 0) {
    output += BASE64_CHARS[(buffer << (6 - bits)) & 0x3f];
  }

  return output.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** JWT fake (sem assinatura) — suficiente para decodeJwtPayload no cliente. */
export function createDemoTokens(userId: string, username: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({ sub: userId, username, iat: Math.floor(Date.now() / 1000) }),
  );
  const accessToken = `${header}.${payload}.demo`;
  const refreshToken = `${header}.${base64UrlEncode(JSON.stringify({ sub: userId, type: 'refresh' }))}.demo`;
  return { accessToken, refreshToken };
}

export const DEMO_USER_ID = 'demo-user-001';
export const DEMO_USERNAME = 'demo';
