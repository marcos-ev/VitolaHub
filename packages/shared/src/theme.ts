// Paleta e tokens visuais da especificação (seção 3) — fonte única de verdade
// consumida tanto pelo app mobile quanto por qualquer futura superfície web.

export const colors = {
  background: '#14100B',
  surface: '#1D1710',
  surfaceElevated: '#251D14',
  divider: '#33291C',
  gold: '#C9A24A',
  goldMuted: '#8A7038',
  textPrimary: '#EFE4CE',
  textSecondary: '#9C8B72',
  textTertiary: '#6E5F4B',
  positive: '#2E7D4F',
  alert: '#A83232',
} as const;

export const radii = {
  sm: 12,
  md: 14,
  lg: 16,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const fonts = {
  // UI do app: Public Sans. Wordmark VITOLA: Playfair (marca combinada).
  display: 'PublicSans_600SemiBold',
  displayBold: 'PublicSans_700Bold',
  body: 'PublicSans_400Regular',
  bodyMedium: 'PublicSans_500Medium',
  bodySemiBold: 'PublicSans_600SemiBold',
  brand: 'PlayfairDisplay_700Bold',
  brandSemi: 'PlayfairDisplay_600SemiBold',
} as const;
