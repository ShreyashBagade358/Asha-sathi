
/**
 * The Tailwind config (tailwind.config.js) is the styling source of truth.
 * This module exists for the ~5% of styles that cannot be expressed as a
 * className: inline computed colors, Reanimated animations (the web does these
 * with CSS @keyframes in index.css), and non-color design constants.
 *
 * Every hex here is duplicated from apps/web-dashboard/tailwind.config.js on
 * purpose - keep the two in sync.
 *
 * Dark mode: the surface / neutral tokens are CSS variables in global.css
 * (auto-swapped by prefers-color-scheme). Accent colours below are static and
 * identical in both themes. Use `useColors()` to get theme-aware inline
 * colours; the plain `colors` export is the light-theme default for backward
 * compatibility.
 */

import { useColorScheme } from 'react-native';

/** Light-theme palette (also the default export for existing callers). */
export const colors = {
  primary: '#242B65',
  primaryContainer: '#383E7D',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#E0E7FF',
  primaryFixed: '#E0E7FF',
  primaryFixedDim: '#A5B4FC',
  onPrimaryFixed: '#1E1B4B',
  onPrimaryFixedVariant: '#312E81',
  secondary: '#10B981',
  secondaryContainer: '#A7F3D0',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#065F46',
  secondaryFixed: '#A7F3D0',
  secondaryFixedDim: '#6EE7B7',
  onSecondaryFixed: '#022C22',
  onSecondaryFixedVariant: '#065F46',
  tertiary: '#0F766E',
  tertiaryContainer: '#CCFBF1',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#134E4A',
  tertiaryFixed: '#CCFBF1',
  tertiaryFixedDim: '#99F6E4',
  onTertiaryFixed: '#042F2E',
  onTertiaryFixedVariant: '#115E59',
  error: '#EF4444',
  onError: '#ffffff',
  errorContainer: '#FEE2E2',
  onErrorContainer: '#991B1B',
  maternal: '#F472B6',
  maternalLight: '#FDF2F8',
  amber: '#F59E0B',
  amberLight: '#FFFBEB',
  teal: '#10B981',
  tealLight: '#ECFDF5',
  // Surface tokens mirror the CSS variables in global.css (light values).
  surface: '#F8FAFC',
  surfaceDim: '#E2E8F0',
  surfaceBright: '#F8FAFC',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F1F5F9',
  surfaceContainer: '#E2E8F0',
  surfaceContainerHigh: '#CBD5E1',
  surfaceContainerHighest: '#94A3B8',
  onSurface: '#1E293B',
  onSurfaceVariant: '#64748B',
  inverseSurface: '#1E293B',
  inverseOnSurface: '#F1F5F9',
  inversePrimary: '#A5B4FC',
  outline: '#94A3B8',
  outlineVariant: '#E2E8F0',
  surfaceTint: '#242B65',
  background: '#F8FAFC',
  onBackground: '#1E293B',
  riskHigh: '#EF4444',
  riskMedium: '#F59E0B',
} as const;

/** Dark-theme palette — accent colours stay the same, surfaces go dark. */
export const darkColors = {
  ...colors,
  // Primary shifts to a lighter indigo so buttons remain visible on dark bg.
  primary: '#4F46E5',
  primaryContainer: '#3730A3',
  onPrimaryContainer: '#C7D2FE',
  // Surfaces
  surface: '#0F172A',
  surfaceDim: '#020617',
  surfaceBright: '#1E293B',
  surfaceContainerLowest: '#020617',
  surfaceContainerLow: '#0F172A',
  surfaceContainer: '#1E293B',
  surfaceContainerHigh: '#334155',
  surfaceContainerHighest: '#475569',
  onSurface: '#F1F5F9',
  onSurfaceVariant: '#94A3B8',
  inverseSurface: '#F1F5F9',
  inverseOnSurface: '#1E293B',
  inversePrimary: '#242B65',
  outline: '#64748B',
  outlineVariant: '#334155',
  surfaceTint: '#A5B4FC',
  background: '#020617',
  onBackground: '#F1F5F9',
} as const;

/**
 * Theme-aware colour hook. Returns the dark palette when the phone is in
 * dark mode, the light palette otherwise. Use for inline styles, Icon
 * `color` props, and Reanimated values that cannot be a className.
 */
export function useColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : colors;
}

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

/**
 * Semantic tone rotation used by the dashboard's care-module grid and KPI cards.
 * The web cycles primary -> secondary -> tertiary plus maternal / amber / teal
 * accents for module-specific tiles.
 */
export type Tone = 'primary' | 'secondary' | 'tertiary' | 'error' | 'maternal' | 'amber' | 'teal' | 'primaryFixed' | 'neutral';

export const toneClass = (tone: Tone) => {
  switch (tone) {
    case 'secondary':
      return { fg: 'text-secondary', container: 'bg-secondary-container', onContainer: 'text-on-secondary-container' };
    case 'tertiary':
      return { fg: 'text-tertiary', container: 'bg-tertiary-container', onContainer: 'text-on-tertiary-container' };
    case 'error':
      return { fg: 'text-error', container: 'bg-error-container', onContainer: 'text-on-error-container' };
    case 'maternal':
      return { fg: 'text-maternal', container: 'bg-maternal-light', onContainer: 'text-maternal' };
    case 'amber':
      return { fg: 'text-amber', container: 'bg-amber-light', onContainer: 'text-amber' };
    case 'teal':
      return { fg: 'text-teal', container: 'bg-teal-light', onContainer: 'text-teal' };
    case 'primaryFixed':
      return { fg: 'text-primary', container: 'bg-primary-fixed', onContainer: 'text-primary' };
    case 'neutral':
      return { fg: 'text-neutral-500', container: 'bg-neutral-100', onContainer: 'text-neutral-500' };
    default:
      return { fg: 'text-primary', container: 'bg-primary-container', onContainer: 'text-on-primary-container' };
  }
};

/**
 * Hex twin of each tone's `fg` class. The web tints icons through CSS
 * `currentColor`, which the RN Icon cannot read, so anything that colours a
 * row of icon + text by tone needs the literal hex here instead.
 */
export const toneColor: Record<Tone, string> = {
  primary: colors.primary,
  secondary: colors.secondary,
  tertiary: colors.tertiary,
  error: colors.error,
  maternal: colors.maternal,
  amber: colors.amber,
  teal: colors.teal,
  primaryFixed: colors.primary,
  neutral: '#64748B',
};
