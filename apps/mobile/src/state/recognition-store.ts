import { create } from 'zustand';
import { RecognitionScanResponse } from '../api/types';

interface RecognitionState {
  lastScan: RecognitionScanResponse | null;
  setLastScan: (scan: RecognitionScanResponse) => void;
  clear: () => void;
}

// Estado transitório (em memória, nunca persistido) só para carregar o
// resultado de `POST /recognition/scan` de `app/recognize/index.tsx` até
// `app/recognize/results.tsx` sem serializar objetos grandes em query params
// da rota.
export const useRecognitionStore = create<RecognitionState>((set) => ({
  lastScan: null,
  setLastScan: (scan) => set({ lastScan: scan }),
  clear: () => set({ lastScan: null }),
}));
