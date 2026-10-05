import { View } from 'react-native';

import { cx } from '@/cx';

export type ProgressTone = 'primary' | 'secondary' | 'tertiary' | 'error' | 'warning';

export type ProgressBarProps = {
  /** 0..1; values outside the range are clamped. */
  value: number;
  tone?: ProgressTone;
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
 */
export function ProgressBar({ value, tone = 'primary', className }: ProgressBarProps) {
  const pct = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)) * 100;
  return (
    <View className={cx('h-2 w-full overflow-hidden rounded-full bg-surface-variant', className)}>
      <View className={cx('h-full rounded-full', TONE_CLS[tone])} style={{ width: `${pct}%` }} />
    </View>
  );
}
