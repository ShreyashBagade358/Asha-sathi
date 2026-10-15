import { View } from 'react-native';

import { cx } from '@/cx';

export type ProgressTone = 'primary' | 'secondary' | 'tertiary' | 'error' | 'warning';

export type ProgressBarProps = {
  /** 0..1; values outside the range are clamped. */
  value: number;
  tone?: ProgressTone;
  /** Announced alongside the percentage (e.g. "Vaccination"). */
  accessibilityLabel?: string;
  className?: string;
};

const TONE_CLS: Record<ProgressTone, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  tertiary: 'bg-tertiary',
  error: 'bg-error',
  warning: 'bg-[#FF8C00]',
};

/**
 * ChildHealthAshaSathi's vaccination progress bar:
 *   h-2 overflow-hidden rounded-full bg-surface-variant
 *   > h-full rounded-full (bg-secondary healthy / #FF8C00 otherwise), width %
 *
 * Exposed to assistive tech as a real progressbar with its 0-100 value; the
 * fill itself is a colour-only indicator a screen reader cannot otherwise see.
 */
export function ProgressBar({ value, tone = 'primary', accessibilityLabel, className }: ProgressBarProps) {
  const pct = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)) * 100;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      className={cx('h-2 w-full overflow-hidden rounded-full bg-surface-variant', className)}
    >
      <View className={cx('h-full rounded-full', TONE_CLS[tone])} style={{ width: `${pct}%` }} />
    </View>
  );
}
