
/**
 * The Tailwind config (tailwind.config.js) is the styling source of truth.
 * This module exists for the ~5% of styles that cannot be expressed as a
 * className: inline computed colors, Reanimated animations (the web does these
 * with CSS @keyframes in index.css), and non-color design constants.
 *
 * Every hex here is duplicated from apps/web-dashboard/tailwind.config.js on
 * purpose - keep the two in sync.
 */

export const colors = {
  primary: '#003267',
  primaryContainer: '#005eb8',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#c8daff',
  primaryFixed: '#d6e3ff',
  primaryFixedDim: '#a9c7ff',
  onPrimaryFixed: '#001b3d',
  onPrimaryFixedVariant: '#00468c',
  secondary: '#006e28',
  secondaryContainer: '#82fc90',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#00752a',
  secondaryFixed: '#82fc90',
  secondaryFixedDim: '#65df77',
  onSecondaryFixed: '#002107',
  onSecondaryFixedVariant: '#00531c',
  tertiary: '#004e61',
  tertiaryContainer: '#006880',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#9be4ff',
  tertiaryFixed: '#b6ebff',
  tertiaryFixedDim: '#57d5fc',
  onTertiaryFixed: '#001f28',
  onTertiaryFixedVariant: '#004e60',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  surface: '#f9f9ff',
  surfaceDim: '#cadbfc',
  surfaceBright: '#f9f9ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f0f3ff',
  surfaceContainer: '#e7eeff',
  surfaceContainerHigh: '#dfe8ff',
  surfaceContainerHighest: '#d6e3ff',
  onSurface: '#091c35',
  onSurfaceVariant: '#424752',
  inverseSurface: '#20314b',
  inverseOnSurface: '#ecf0ff',
  inversePrimary: '#a9c7ff',
  outline: '#727783',
  outlineVariant: '#c2c6d4',
  surfaceTint: '#005db6',
  background: '#f9f9ff',
  onBackground: '#091c35',
  riskHigh: '#7b0000',
  riskMedium: '#f59e0b',
} as const;

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
 * Semantic tone rotation used by the dashboard's care-module grid and KPI cards
 * (the web cycles primary -> secondary -> tertiary across tiles).
 */
export type Tone = 'primary' | 'secondary' | 'tertiary' | 'error';

export const toneClass = (tone: Tone) => {
  switch (tone) {
    case 'secondary':
      return { fg: 'text-secondary', container: 'bg-secondary-container', onContainer: 'text-on-secondary-container' };
    case 'tertiary':
      return { fg: 'text-tertiary', container: 'bg-tertiary-fixed', onContainer: 'text-tertiary' };
    case 'error':
      return { fg: 'text-error', container: 'bg-error-container', onContainer: 'text-on-error-container' };
    default:
      return { fg: 'text-primary', container: 'bg-primary-container', onContainer: 'text-on-primary' };
  }
};
