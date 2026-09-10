// Chaves de recursos controlados por plano (seção 6.2). O backend é sempre a
// fonte da verdade (seção 6.4) — este enum só nomeia os recursos para que
// cliente e servidor concordem sobre o que cada chave significa.

export enum FeatureKey {
  HUMIDOR_OVER_25 = 'HUMIDOR_OVER_25',
  TASTE_STATS = 'TASTE_STATS',
  PHOTO_RECOGNITION = 'PHOTO_RECOGNITION',
  REVIEW_HISTORY_FULL = 'REVIEW_HISTORY_FULL', // além dos últimos 90 dias
  EXPORT_CSV_PDF = 'EXPORT_CSV_PDF',
  ADVANCED_SEARCH_FILTERS = 'ADVANCED_SEARCH_FILTERS',
  COMPARE_CIGARS = 'COMPARE_CIGARS',
  SUBSCRIBER_BADGE = 'SUBSCRIBER_BADGE',
  AD_FREE = 'AD_FREE',
  UNLIMITED_PRIVATE_NOTES = 'UNLIMITED_PRIVATE_NOTES',
}

export const FREE_HUMIDOR_LIMIT = 25;
export const FREE_REVIEW_HISTORY_DAYS = 90;
export const TRIAL_DAYS = 7;

export interface EntitlementSnapshot {
  isPremium: boolean;
  isTrial: boolean;
  trialEndsAt: string | null;
  premiumUntil: string | null;
  features: Record<FeatureKey, boolean>;
  resolvedAt: string;
}

export function buildFeatureMap(hasPremiumAccess: boolean): Record<FeatureKey, boolean> {
  const entries = Object.values(FeatureKey).map((key) => [key, hasPremiumAccess] as const);
  return Object.fromEntries(entries) as Record<FeatureKey, boolean>;
}
