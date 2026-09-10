import { buildFullName, normalizeCountryCode, normalizeVitola, parseLengthMm } from './catalog-import.util';

describe('normalizeCountryCode', () => {
  it('aceita código ISO alpha-2 já no formato certo e reconhece países do universo de charutos', () => {
    expect(normalizeCountryCode('CU')).toEqual({ code: 'CU', recognized: true });
    expect(normalizeCountryCode(' br ')).toEqual({ code: 'BR', recognized: true });
  });

  it('aceita minúsculo e converte para maiúsculo', () => {
    expect(normalizeCountryCode('ni')).toEqual({ code: 'NI', recognized: true });
  });

  it('sinaliza recognized=false para código no formato certo mas fora da lista conhecida (sem bloquear)', () => {
    expect(normalizeCountryCode('FR')).toEqual({ code: 'FR', recognized: false });
  });

  it('converte nome de país por extenso (com acento) para o código ISO', () => {
    expect(normalizeCountryCode('Nicarágua')).toEqual({ code: 'NI', recognized: true });
    expect(normalizeCountryCode('República Dominicana')).toEqual({ code: 'DO', recognized: true });
    expect(normalizeCountryCode('brasil')).toEqual({ code: 'BR', recognized: true });
  });

  it('retorna erro quando o valor não é reconhecível como país', () => {
    const result = normalizeCountryCode('Terra do Nunca');
    expect(result.code).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('retorna erro quando o país não foi informado', () => {
    expect(normalizeCountryCode(undefined).error).toBeDefined();
    expect(normalizeCountryCode('').error).toBeDefined();
  });
});

describe('normalizeVitola', () => {
  it('reconhece a bitola tolerando acento e caixa', () => {
    expect(normalizeVitola('robusto')).toEqual({ value: 'Robusto', recognized: true });
    expect(normalizeVitola('PETIT CORONA')).toEqual({ value: 'Petit Corona', recognized: true });
    expect(normalizeVitola('belicoso')).toEqual({ value: 'Belicoso', recognized: true });
  });

  it('mantém o valor original quando fora da lista controlada, mas marca como não reconhecida', () => {
    expect(normalizeVitola('Gigante Especial')).toEqual({ value: 'Gigante Especial', recognized: false });
  });

  it('retorna null quando não informado', () => {
    expect(normalizeVitola(undefined)).toEqual({ value: null, recognized: false });
  });
});

describe('parseLengthMm', () => {
  it('mantém o valor em mm quando não há indicador de polegada e a unidade padrão é mm', () => {
    expect(parseLengthMm('140', 'mm')).toEqual({ valueMm: 140, unit: 'mm' });
  });

  it('converte de polegadas para mm quando o valor contém "in"', () => {
    const result = parseLengthMm('5.5in', 'mm');
    expect(result.unit).toBe('in');
    expect(result.valueMm).toBeCloseTo(5.5 * 25.4, 2);
  });

  it('converte de polegadas para mm quando o valor contém aspas duplas', () => {
    const result = parseLengthMm('6"', 'mm');
    expect(result.unit).toBe('in');
    expect(result.valueMm).toBeCloseTo(6 * 25.4, 2);
  });

  it('usa a unidade explícita da requisição quando a célula não indica unidade', () => {
    const result = parseLengthMm('6', 'in');
    expect(result.unit).toBe('in');
    expect(result.valueMm).toBeCloseTo(6 * 25.4, 2);
  });

  it('aceita vírgula como separador decimal (padrão brasileiro)', () => {
    expect(parseLengthMm('140,5', 'mm').valueMm).toBeCloseTo(140.5, 2);
  });

  it('retorna null e sem erro quando a célula está vazia', () => {
    expect(parseLengthMm('', 'mm')).toEqual({ valueMm: null, unit: 'mm' });
  });

  it('retorna erro quando o valor não é numérico', () => {
    const result = parseLengthMm('abc', 'mm');
    expect(result.valueMm).toBeNull();
    expect(result.error).toBeDefined();
  });
});

describe('buildFullName', () => {
  it('combina marca, linha e nome ignorando linha ausente', () => {
    expect(buildFullName('Cohiba', 'Línea 1966', 'Robusto')).toBe('Cohiba Línea 1966 Robusto');
    expect(buildFullName('Cohiba', null, 'Robusto')).toBe('Cohiba Robusto');
  });
});
