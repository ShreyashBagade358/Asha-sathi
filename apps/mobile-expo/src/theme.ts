import { useCallback } from 'react';
import { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

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
  tertiary: '#004e61',
  tertiaryContainer: '#006880',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#9be4ff',
  tertiaryFixed: '#b6ebff',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  surface: '#f9f9ff',
  surfaceDim: '#cadbfc',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f0f3ff',
  surfaceContainer: '#e7eeff',
  surfaceContainerHigh: '#dfe8ff',
  surfaceContainerHighest: '#d6e3ff',
  onSurface: '#091c35',
  onSurfaceVariant: '#424752',
  inverseSurface: '#20314b',
  inverseOnSurface: '#ecf0ff',
  outline: '#727783',
  outlineVariant: '#c2c6d4',
  surfaceTint: '#005db6',
  background: '#f9f9ff',
} as const;

export const riskColors = {
  high: '#7b0000',
  medium: '#f59e0b',
  low: colors.secondary,
} as const;

export const radius = {
  sm: 2,
  DEFAULT: 4,
  md: 6,
  lg: 8,
  xl: 12,
  card: 16,
  '3xl': 24,
  full: 9999,
} as const;

export const spacing = {
  formGap: 20,
  touchTarget: 48,
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

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/**
 * Semantic tone rotation used by the dashboard's care-module grid and KPI cards
 * (the web cycles primary -> secondary -> tertiary across tiles).
 */
export type Tone = 'primary' | 'secondary' | 'tertiary' | 'error';

export const toneColors = (tone: Tone) => {
  switch (tone) {
    case 'secondary':
      return { fg: colors.secondary, container: colors.secondaryContainer, onContainer: colors.onSecondaryContainer };
    case 'tertiary':
      return { fg: colors.tertiary, container: colors.tertiaryFixed, onContainer: colors.tertiary };
    case 'error':
      return { fg: colors.error, container: colors.errorContainer, onContainer: colors.onErrorContainer };
    default:
      return { fg: colors.primary, container: colors.primaryContainer, onContainer: colors.onPrimary };
  }
};

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

/** Web: .animate-fade-up (translateY 16px -> 0, 0.5s ease) */
export function useFadeUp(delay = 0) {
  const progress = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: 16 * (1 - progress.value) }],
  }));
  const start = useCallback(() => {
    progress.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.ease), });
  }, [progress]);
  return { style, start, delay };
}

/** Web: .animate-fade-in (0.2s ease-out) */
export function useFadeIn(delay = 0) {
  const progress = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: progress.value }));
  const start = useCallback(() => {
    progress.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
  }, [progress]);
  return { style, start, delay };
}

/** Web: .loader-ring - spin 1.5s linear infinite */
export function useSpin() {
  const rotation = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const start = useCallback(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 1500, easing: Easing.linear }), -1, false);
  }, [rotation]);
  return { style, start };
}

/** Web: .ambient-blob / @keyframes float - 10s ease-in-out infinite alternate */
export function useFloat(amplitude = 8, durationMs = 4000) {
  const offset = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const start = useCallback(() => {
    offset.value = withRepeat(
      withSequence(withTiming(-amplitude, { duration: durationMs, easing: Easing.inOut(Easing.ease) }), withTiming(amplitude, { duration: durationMs, easing: Easing.inOut(Easing.ease) })),
      -1,
      false,
    );
  }, [offset, amplitude, durationMs]);
  return { style, start };
}

/** Web: .pulse-subtle - pulseSubtle 2s cubic-bezier(0.4,0,0.6,1) infinite */
export function usePulseSubtle() {
  const pulse = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const start = useCallback(() => {
    pulse.value = withRepeat(withSequence(withTiming(0.97, { duration: 1000, easing: Easing.inOut(Easing.cubic) }), withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.cubic) })), -1, false);
  }, [pulse]);
  return { style, start };
}

/** Web: @keyframes asha-pulse-ring - scale 1 -> 1.6, opacity 0.5 -> 0 */
export function usePulseRing() {
  const pulse = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.6 * pulse.value }],
    opacity: 0.5 * (1 - pulse.value),
  }));
  const start = useCallback(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false);
    pulse.value = 0;
  }, [pulse]);
  return { style, start };
}

/** Touch feedback for the web's active:scale-[0.97] press states. */
export function usePressScale(scaleTo = 0.97) {
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 - (1 - scaleTo) * pressed.value }] }));
  const onPressIn = useCallback(() => {
    pressed.value = withSpring(1, { damping: 18, stiffness: 320 });
  }, [pressed]);
  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, { damping: 18, stiffness: 320 });
  }, [pressed]);
  return { style, onPressIn, onPressOut, isPressed: pressed };
}

/** Web: .animate-shake - horizontal 0.4s shake, used for OTP error states. */
export function useShake(shake: { value: number }) {
  const translate = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: translate.value }] }));
  const run = useCallback(() => {
    translate.value = withSequence(
      withTiming(-6, { duration: 66 }),
      withTiming(6, { duration: 66 }),
      withTiming(-4, { duration: 66 }),
      withTiming(4, { duration: 66 }),
      withTiming(0, { duration: 66 }),
    );
  }, [translate]);
  return { style, run };
}
