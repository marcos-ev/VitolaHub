import { create } from 'zustand';

interface InviteState {
  pendingCode: string | null;
  setPendingCode: (code: string | null) => void;
}

// Estado simples e só em memória (sem persistência, ao contrário de
// `auth-store.ts`): guarda o código de convite extraído de um deep link
// `vitolahub://convite/{codigo}` (ver `app/_layout.tsx`) até o formulário de
// cadastro (`app/(auth)/register.tsx`) ler e pré-preencher o campo.
export const useInviteStore = create<InviteState>((set) => ({
  pendingCode: null,
  setPendingCode: (code) => set({ pendingCode: code }),
}));
