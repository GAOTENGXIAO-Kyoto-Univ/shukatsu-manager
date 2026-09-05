import { defaultConfig } from '@tamagui/config/v5';
import { createTamagui } from 'tamagui';

export const warmPaperColors = {
  background: '#F6F4F1',
  surface: '#FFFFFF',
  surfaceMuted: '#F1EEE9',
  text: '#333333',
  textSecondary: '#6F6A63',
  textMuted: '#958E85',
  border: '#E6E1D9',
  accent: '#A69B8C',
  accentStrong: '#75695C',
  accentSoft: '#EEEAE5',
  success: '#A8B89A',
  successStrong: '#6F8062',
  successSoft: '#E8EEE3',
  info: '#A7B8C9',
  infoStrong: '#6E8397',
  infoSoft: '#E7EDF2',
  warning: '#D8A18A',
  warningStrong: '#A8664F',
  warningSoft: '#F4E7E0',
  danger: '#B8685F',
  dangerSoft: '#F3E3E0',
  focusRing: '#BFB3A6',
  overlayBackdrop: 'rgba(51, 51, 51, 0.18)',
} as const;

const tamaguiConfig = createTamagui({
  ...defaultConfig,
  media: {
    ...defaultConfig.media,
    md: { minWidth: 768 },
  },
  tokens: {
    ...defaultConfig.tokens,
    color: {
      ...warmPaperColors,
    },
    radius: {
      ...defaultConfig.tokens.radius,
      sm: 8,
      md: 12,
      lg: 16,
      pill: 9999,
    },
    space: {
      ...defaultConfig.tokens.space,
      xs: 4,
      sm: 8,
      md: 12,
      base: 16,
      lg: 24,
      xl: 32,
      xxl: 40,
    },
  },
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      ...warmPaperColors,
      color: warmPaperColors.text,
    },
  },
});

export default tamaguiConfig;

export type AppTamaguiConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}
