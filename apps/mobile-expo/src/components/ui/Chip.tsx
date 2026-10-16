import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { cx } from '@/cx';
import { colors } from '@/theme';

export type ChipTone = 'success' | 'error' | 'warning' | 'info' | 'neutral';
export type ChipSize = 'sm' | 'md';

export type ChipProps = {
  children: string;
  tone?: ChipTone;
  size?: ChipSize;
  /** Leading status glyph, e.g. the risk chip's alert triangle. */
  icon?: ReactNode;
  className?: string;
};

/**
 * Port of the status pills scattered across the web ASHA pages, e.g.
 * PatientDetailsAshaSathi's risk chip:
 *   inline-flex items-center gap-1 rounded-full px-2 py-0.5
 *   + font-caption text-caption font-semibold
 *
 * Tone pairs are the ones the dashboard actually ships. Medium risk uses the
 * amber accent (#F59E0B / light tint) per the Indigo + Teal palette.
 */
const TONE_CLS: Record<ChipTone, { bg: string; fg: string }> = {
  success: { bg: 'bg-secondary-container', fg: 'text-on-secondary-container' },
  error: { bg: 'bg-error-container', fg: 'text-on-error-container' },
  warning: { bg: 'bg-amber-light', fg: 'text-amber' },
  info: { bg: 'bg-tertiary-container', fg: 'text-on-tertiary-container' },
  neutral: { bg: 'bg-surface-variant', fg: 'text-on-surface-variant' },
};

/** Hex twin of each tone's text colour for tinting a caller-supplied glyph. */
export const chipToneColor: Record<ChipTone, string> = {
  success: colors.onSecondaryContainer,
  error: colors.onErrorContainer,
  warning: colors.amber,
  info: colors.onTertiaryContainer,
  neutral: colors.onSurfaceVariant,
};

export function Chip({ children, tone = 'neutral', size = 'sm', icon, className }: ChipProps) {
  const t = TONE_CLS[tone];
  return (
    <View className={cx('flex-row items-center gap-1 self-start rounded-full px-2 py-0.5', t.bg, className)}>
      {icon}
      <Text className={cx(size === 'sm' ? 'font-caption text-caption font-semibold' : 'font-label-md text-label-md', t.fg)}>
        {children}
      </Text>
    </View>
  );
}
