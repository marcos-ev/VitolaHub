import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * `expo-secure-store` não tem implementação real na Web (Keychain/Keystore
 * não existem no navegador) — `getValueWithKeyAsync` nem existe no shim web,
 * e chamar `SecureStore.getItemAsync` direto quebra a build PWA (seção 2 da
 * spec exige Expo Web desde o início). Usamos `localStorage` como fallback na
 * Web: não é "seguro" no mesmo sentido do Keychain, mas é o equivalente do
 * ecossistema (mesma garantia que qualquer PWA de banco/pagamento tem no
 * browser) e mantém o resto do app agnóstico de plataforma.
 */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
