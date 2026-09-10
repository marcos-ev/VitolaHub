// Regra inegociável da spec: a API só devolve `cigarId`s reais de charutos já
// existentes no catálogo + um percentual de confiança explícito — nunca um
// objeto "charuto" inventado pelo modelo multimodal.
export interface RecognitionCandidate {
  cigarId: string;
  brandName: string;
  cigarName: string;
  line: string | null;
  vitola: string | null;
  imageUrl: string | null;
  /** 0-100, para o mobile desenhar o selo/chip de compatibilidade. */
  confidencePercent: number;
}

export interface VitolaOption {
  cigarId: string;
  vitola: string | null;
}

export interface RecognitionScanResult {
  /** Id do `RecognitionMatch` gravado, ou `null` quando nem chegamos a persistir nada (falha antes do recorte). */
  matchId: string | null;
  imageHash: string;
  /** URL pública do recorte gerado, ou `null` no fallback total. */
  cropUrl: string | null;
  matches: RecognitionCandidate[];
  /** Quando a linha reconhecida tem mais de uma vitola no catálogo — mobile deve perguntar antes de confirmar. */
  requiresVitolaDisambiguation: boolean;
  vitolaOptions: VitolaOption[];
  /** Timeout, erro, sem API key configurada, ou nenhum candidato relevante — mobile deve oferecer busca manual. */
  fallbackToManualSearch: boolean;
}

export interface RecognitionJobData {
  userId: string;
  objectKey: string;
  imageHash: string;
}
