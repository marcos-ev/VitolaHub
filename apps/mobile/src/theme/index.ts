import { colors, radii, spacing, fonts } from '@charuto/shared';

// Reexporta os tokens compartilhados e acrescenta valores específicos de
// React Native (sombras, alturas de toque) que não fazem sentido no pacote
// `shared` (consumido também por uma eventual superfície web pura).
export const theme = {
  colors,
  radii,
  spacing,
  fonts,
  touchable: {
    minHeight: 44,
  },
  shadow: {
    // Sombra discreta (seção 3): "sem sombra exagerada".
    subtle: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 3,
    },
  },
} as const;

export type Theme = typeof theme;
