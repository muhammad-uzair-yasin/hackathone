// BioRoute Cold-Chain — Design System Colors
// Extracted from Stitch design system

export const Colors = {
  primary: '#0058bc',
  primaryContainer: '#0070eb',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#fefcff',
  primaryFixed: '#d8e2ff',
  primaryFixedDim: '#adc6ff',
  inversePrimary: '#adc6ff',
  onPrimaryFixed: '#001a41',
  onPrimaryFixedVariant: '#004493',
  surfaceTint: '#005bc1',

  secondary: '#566068',
  secondaryContainer: '#dae4ee',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#5c666e',
  secondaryFixed: '#dae4ee',
  secondaryFixedDim: '#bec8d1',
  onSecondaryFixed: '#131d24',
  onSecondaryFixedVariant: '#3e4850',

  tertiary: '#475d7a',
  tertiaryContainer: '#607693',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#fdfcff',
  tertiaryFixed: '#d2e4ff',
  tertiaryFixedDim: '#b1c8e9',
  onTertiaryFixed: '#021c36',
  onTertiaryFixedVariant: '#324863',

  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',

  background: '#f7f9fb',
  onBackground: '#191c1e',

  surface: '#f7f9fb',
  surfaceBright: '#f7f9fb',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f2f4f6',
  surfaceContainer: '#eceef0',
  surfaceContainerHigh: '#e6e8ea',
  surfaceContainerHighest: '#e0e3e5',
  surfaceDim: '#d8dadc',
  surfaceVariant: '#e0e3e5',

  onSurface: '#191c1e',
  onSurfaceVariant: '#414755',
  inverseSurface: '#2d3133',
  inverseOnSurface: '#eff1f3',

  outline: '#717786',
  outlineVariant: '#c1c6d7',

  // Convenience aliases
  white: '#ffffff',
  black: '#000000',

  // Glass / glassmorphism
  glassBackground: 'rgba(255, 255, 255, 0.7)',
  glassBorder: 'rgba(255, 255, 255, 0.3)',
  
  // Gradients helpers
  gradientStart: '#0058bc',
  gradientEnd: '#0070eb',

  // Logistics Agent UI
  pageBackground: '#F9FAFB',
  cardBackground: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  accentBlue: '#3B82F6',
  accentBlueBright: '#2D79FF',
  accentPurple: '#8B5CF6',
  accentPurpleDeep: '#7B42F6',
  success: '#10B981',
  borderLight: '#E5E7EB',
  iconPurpleBg: '#EDE9FE',
  iconBlueBg: '#DBEAFE',
  iconGreenBg: '#D1FAE5',
  versionTagBg: '#DBEAFE',
};

export type ColorKey = keyof typeof Colors;
