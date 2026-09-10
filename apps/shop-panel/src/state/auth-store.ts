import { create } from 'zustand';

const ACCESS_TOKEN_KEY = 'charuto.shopPanel.accessToken';
const REFRESH_TOKEN_KEY = 'charuto.shopPanel.refreshToken';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
}

// Equivalente web de `apps/mobile/src/state/auth-store.ts`: mesma forma
// (zustand + accessToken/refreshToken), mas persistindo em `localStorage`
// em vez de `expo-secure-store`, já que este é um app de navegador, não um
// app nativo com Keychain/Keystore disponível.
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
  refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken, refreshToken });
  },

  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    set({ accessToken: null, refreshToken: null });
  },
}));
