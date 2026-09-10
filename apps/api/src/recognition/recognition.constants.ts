// Constantes do fluxo de reconhecimento do charuto por foto (seção 5.7).

// Nome do único job da fila `recognition`.
export const RECOGNITION_JOB_NAME = 'scan';

// Timeout interno do processor (BullMQ worker): se o pipeline completo
// (download + crop + modelo multimodal + casamento no catálogo) não terminar
// dentro desse prazo, o job resolve imediatamente com o fallback de busca
// manual — o pipeline real continua rodando em segundo plano só para
// popular o cache por hash a tempo do próximo scan da mesma foto.
export const RECOGNITION_PROCESSOR_TIMEOUT_MS = 10_000;

// Timeout do lado HTTP (request-reply sobre BullMQ via `job.waitUntilFinished`).
// Maior que o timeout do processor para dar folga ao worker pegar o job da
// fila antes de desistir e responder com o fallback.
export const RECOGNITION_HTTP_WAIT_TIMEOUT_MS = 12_000;

// TTL do cache rápido por hash no Redis (camada extra além do índice
// `imageHash` no Postgres) — "evita cobrar duas vezes pela mesma foto".
export const RECOGNITION_HASH_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

// Heurística de MVP para o recorte: o mobile já orienta o usuário a
// centralizar a anilha no guia de enquadramento da câmera, então um recorte
// central de 60% da área da foto já isola razoavelmente bem a anilha sem
// precisar de correção de perspectiva sofisticada.
export const RECOGNITION_CENTER_CROP_RATIO = 0.6;

// Quantidade máxima de candidatos devolvidos por scan.
export const RECOGNITION_TOP_MATCHES_LIMIT = 3;

// Score mínimo (0-1, combinação ponderada de `similarity()` do pg_trgm) para
// um candidato ser considerado relevante o bastante para aparecer na resposta.
export const RECOGNITION_MIN_SCORE_THRESHOLD = 0.15;

// Modelo multimodal da Anthropic usado para extrair o texto da anilha.
export const ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';
export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_FETCH_TIMEOUT_MS = 9_000;

export function recognitionCacheKey(imageHash: string): string {
  return `recognition:hash:${imageHash}`;
}

export function recognitionJobId(imageHash: string): string {
  // jobId determinístico (seção 5.7): duas requisições concorrentes para a
  // mesma foto reaproveitam o mesmo job em vez de chamar o modelo duas
  // vezes. BullMQ usa `:` como separador interno da chave do job no Redis e
  // rejeita `:` em ids customizados — por isso o prefixo usa `-`, não `:`.
  return `recognition-${imageHash}`;
}
