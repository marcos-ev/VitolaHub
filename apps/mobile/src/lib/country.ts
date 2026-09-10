// Converte um código ISO-3166 alpha-2 (ex.: "BR", "CU") no emoji de bandeira
// correspondente, usando os símbolos indicadores regionais do Unicode.
export function countryCodeToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 0x1f1e6 + (char.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}
