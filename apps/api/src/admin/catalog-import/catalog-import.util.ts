import { COUNTRY_NAME_TO_CODE, KNOWN_CIGAR_COUNTRIES, KNOWN_VITOLAS } from './catalog-import.constants';

export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export interface NormalizedCountry {
  code: string | null;
  recognized: boolean;
  error?: string;
}

/**
 * Normaliza o campo `pais` da planilha: aceita tanto o código ISO 3166-1
 * alpha-2 (ex.: "BR") quanto o nome do país por extenso (ex.: "Brasil"),
 * tolerando acento/caixa. Formato de 2 letras é obrigatório para não gerar
 * erro — a lista `KNOWN_CIGAR_COUNTRIES` só sinaliza um aviso quando o
 * código está fora do universo mais comum de charutos (não bloqueia).
 */
export function normalizeCountryCode(raw: string | null | undefined): NormalizedCountry {
  if (!raw || !raw.trim()) {
    return { code: null, recognized: false, error: 'país não informado' };
  }

  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) {
    return { code: upper, recognized: upper in KNOWN_CIGAR_COUNTRIES };
  }

  const key = stripAccents(trimmed).toLowerCase();
  const mapped = COUNTRY_NAME_TO_CODE[key];
  if (mapped) return { code: mapped, recognized: true };

  return {
    code: null,
    recognized: false,
    error: `país "${raw}" não reconhecido; use um código ISO 3166-1 alpha-2 (ex.: BR, CU, NI, DO, HN, US, MX, JM, ES)`,
  };
}

export interface NormalizedVitola {
  value: string | null;
  recognized: boolean;
}

/** Normaliza a bitola contra a lista controlada, tolerando acento/caixa. */
export function normalizeVitola(raw: string | null | undefined): NormalizedVitola {
  if (!raw || !raw.trim()) return { value: null, recognized: false };

  const key = stripAccents(raw.trim()).toLowerCase();
  const match = KNOWN_VITOLAS.find((v) => stripAccents(v).toLowerCase() === key);
  if (match) return { value: match, recognized: true };

  // Não bloqueia: bitolas fora da lista controlada existem (ex. formatos
  // exclusivos de fabricante) — só fica sem o "selo" de reconhecida.
  return { value: raw.trim(), recognized: false };
}

export interface ParsedLength {
  valueMm: number | null;
  unit: 'mm' | 'in';
  error?: string;
}

/**
 * Converte o comprimento para milímetros (seção 5.3). Heurística: se o
 * valor bruto da célula contém "in" ou aspas duplas (polegadas), converte
 * por 25.4; senão usa `requestUnit` (parâmetro explícito da requisição,
 * default "mm").
 */
export function parseLengthMm(raw: unknown, requestUnit: 'mm' | 'in' = 'mm'): ParsedLength {
  if (raw === null || raw === undefined || raw === '') {
    return { valueMm: null, unit: requestUnit };
  }

  const str = String(raw).trim();
  const hasInchMarker = /\d\s*in\b/i.test(str) || str.includes('"');
  const numericStr = str.replace(',', '.').replace(/[^0-9.\-]/g, '');
  const numeric = parseFloat(numericStr);

  if (Number.isNaN(numeric)) {
    return { valueMm: null, unit: requestUnit, error: `comprimento "${raw}" inválido` };
  }

  const unit: 'mm' | 'in' = hasInchMarker ? 'in' : requestUnit;
  const valueMm = unit === 'in' ? Math.round(numeric * 25.4 * 100) / 100 : numeric;
  return { valueMm, unit };
}

export function parseOptionalNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const numeric = parseFloat(String(raw).replace(',', '.'));
  return Number.isNaN(numeric) ? null : numeric;
}

export function parseOptionalInt(raw: unknown): number | null {
  const numeric = parseOptionalNumber(raw);
  return numeric === null ? null : Math.round(numeric);
}

export function parseOptionalString(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  return trimmed === '' ? null : trimmed;
}

/** Nome completo usado como chave de dedup/similaridade: marca + linha + nome. */
export function buildFullName(brandName: string, line: string | null, name: string): string {
  return [brandName, line, name].filter(Boolean).join(' ').trim();
}
