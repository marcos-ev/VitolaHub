// Listas de validação do importador de catálogo (seção 5.3). Não são
// exaustivas de propósito — cobrem o universo mais comum de charutos
// premium — e servem só para sinalizar avisos ao admin, nunca para bloquear
// a importação de uma linha com valor fora da lista.

// Países de origem mais comuns no universo de charutos. Mapeado
// código -> nome só para mensagens; a validação de fato usa as chaves.
export const KNOWN_CIGAR_COUNTRIES: Record<string, string> = {
  CU: 'Cuba',
  NI: 'Nicarágua',
  DO: 'República Dominicana',
  HN: 'Honduras',
  US: 'Estados Unidos',
  BR: 'Brasil',
  MX: 'México',
  JM: 'Jamaica',
  ES: 'Espanha',
  CO: 'Colômbia',
  EC: 'Equador',
  PA: 'Panamá',
  CR: 'Costa Rica',
  PH: 'Filipinas',
  ID: 'Indonésia',
  CM: 'Camarões',
};

// Nome por extenso (sem acento, minúsculo) -> código ISO alpha-2, usado
// quando a planilha vier com o nome do país em vez da sigla.
export const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  cuba: 'CU',
  nicaragua: 'NI',
  'republica dominicana': 'DO',
  honduras: 'HN',
  'estados unidos': 'US',
  eua: 'US',
  usa: 'US',
  brasil: 'BR',
  mexico: 'MX',
  jamaica: 'JM',
  espanha: 'ES',
  colombia: 'CO',
  equador: 'EC',
  panama: 'PA',
  'costa rica': 'CR',
  filipinas: 'PH',
  indonesia: 'ID',
  camaroes: 'CM',
};

// Bitolas controladas (vitolas). Normalização é tolerante a acento/caixa;
// valores fora da lista não são bloqueados, só sinalizados como aviso.
export const KNOWN_VITOLAS = [
  'Robusto',
  'Toro',
  'Churchill',
  'Corona',
  'Petit Corona',
  'Belicoso',
  'Torpedo',
  'Perfecto',
  'Lonsdale',
  'Panetela',
] as const;

// Cabeçalhos esperados no CSV/XLSX (seção 5.3). Chaves em minúsculo — a
// leitura do arquivo normaliza o cabeçalho antes de mapear.
export const CATALOG_IMPORT_COLUMNS = [
  'marca',
  'fabricante',
  'pais',
  'linha',
  'nome',
  'vitola',
  'comprimento_mm',
  'bitola_ring_gauge',
  'forca',
  'capa',
  'tempo_medio_min',
  'imagem_url',
] as const;

export const DUPLICATE_SIMILARITY_THRESHOLD = 0.85;
