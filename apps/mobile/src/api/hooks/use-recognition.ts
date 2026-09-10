import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../client';
import {
  RecognitionConfirmPayload,
  RecognitionConfirmResponse,
  RecognitionScanPayload,
  RecognitionScanResponse,
} from '../types';

// POST /recognition/scan — reconhecimento da anilha por foto (seção 5.7).
// SUPOSIÇÃO: contrato documentado em src/api/types.ts, a confirmar com o
// agente de backend responsável pelo módulo `recognition/`.
export function useScanRecognition() {
  return useMutation({
    mutationFn: (payload: RecognitionScanPayload) =>
      apiFetch<RecognitionScanResponse>('/recognition/scan', { method: 'POST', body: payload }),
  });
}

// POST /recognition/:matchId/confirm — confirma qual candidato é o correto.
export function useConfirmRecognitionMatch() {
  return useMutation({
    mutationFn: ({ matchId, ...payload }: RecognitionConfirmPayload & { matchId: string }) =>
      apiFetch<RecognitionConfirmResponse>(`/recognition/${matchId}/confirm`, {
        method: 'POST',
        body: payload,
      }),
  });
}
