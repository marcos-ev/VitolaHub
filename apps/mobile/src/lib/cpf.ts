/** Remove máscara — deixa só dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function allSameDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

function cpfCheckDigits(base: string): string {
  const calc = (slice: string, factors: number[]) => {
    const sum = slice.split('').reduce((acc, n, i) => acc + Number(n) * factors[i], 0);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d1 = calc(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(base + d1, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${d1}${d2}`;
}

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || allSameDigits(d)) return false;
  return d.slice(9) === cpfCheckDigits(d.slice(0, 9));
}

function cnpjCheckDigits(base: string): string {
  const calc = (slice: string, factors: number[]) => {
    const sum = slice.split('').reduce((acc, n, i) => acc + Number(n) * factors[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(base + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${d1}${d2}`;
}

export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14 || allSameDigits(d)) return false;
  return d.slice(12) === cnpjCheckDigits(d.slice(0, 12));
}
