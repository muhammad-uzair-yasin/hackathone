export { Colors } from './colors';
export type { ColorKey } from './colors';

export const Typography = {
  headlineXL: { fontSize: 40, lineHeight: 48, fontWeight: '700' as const, letterSpacing: -0.8 },
  headlineLG: { fontSize: 32, lineHeight: 40, fontWeight: '600' as const, letterSpacing: -0.64 },
  headlineMD: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const },
  headlineSM: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
  bodyLG: { fontSize: 18, lineHeight: 28, fontWeight: '400' as const },
  bodyMD: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodySM: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  labelMD: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.6 },
  labelSM: { fontSize: 10, lineHeight: 12, fontWeight: '700' as const, letterSpacing: 0.5 },
  dataMono: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: -0.14 },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
};

export const Shadows = {
  neumorphicFlat: {
    shadowColor: '#d1d9e6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  cardLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardStrong: {
    shadowColor: '#0058bc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
};
