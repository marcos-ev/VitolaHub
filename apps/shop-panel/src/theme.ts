import { colors, radii, spacing } from '@charuto/shared';

// Reexporta os tokens compartilhados (fonte única de verdade em
// `packages/shared/src/theme.ts`) e complementa com o que só faz sentido
// nesta superfície web de maior densidade (desktop/tablet).
export { colors, radii, spacing };

// No mobile as fontes são carregadas via @expo-google-fonts (nomes de família
// gerados por aquele pacote). Aqui carregamos as mesmas famílias do Google
// Fonts via <link> no index.html, então os nomes CSS são os "de verdade".
export const fonts = {
  display: "'Playfair Display', serif",
  body: "'Inter', system-ui, sans-serif",
} as const;

export const fontWeights = {
  displaySemiBold: 600,
  displayBold: 700,
  bodyRegular: 400,
  bodyMedium: 500,
  bodySemiBold: 600,
} as const;

// Breakpoints simples para o layout de desktop/tablet do painel — o app
// mobile não precisa disso porque roda numa única largura de tela.
export const breakpoints = {
  tablet: 768,
  desktop: 1200,
} as const;

export const shadows = {
  // Sombra discreta, nunca "flutuante" — a estética é de tabacaria, não de
  // dashboard corporativo genérico.
  card: '0 1px 2px rgba(0, 0, 0, 0.4)',
} as const;
