import Constants from 'expo-constants';

/** Ativo via EXPO_PUBLIC_DEMO_MODE ou extra.demoMode (app.config.js / EAS). */
export function isDemoMode(): boolean {
  if (Constants.expoConfig?.extra?.demoMode === true) return true;
  return process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
}

export const DEMO_MODE = isDemoMode();
