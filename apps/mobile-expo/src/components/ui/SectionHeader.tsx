import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { cx } from '@/cx';

export type SectionHeaderTone = 'default' | 'error';

export type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  /** Right-hand affordance, e.g. a "View All" pill. */
  action?: ReactNode;
  /** 'error' paints the title text-error (the web's High Risk Alerts head). */
  tone?: SectionHeaderTone;
  className?: string;
};

/**
 * Web section heads are `font-headline-md text-headline-md font-semibold
 * text-on-surface`, e.g. AshaWorkerHomeAshaSathi's High Risk Alerts block uses
 * the same recipe with text-error. Lives here rather than in Card.tsx so the
 * barrel can export it once; Card re-exports it for existing import paths.
 */
export function SectionHeader({ title, subtitle, action, tone = 'default', className }: SectionHeaderProps) {
  return (
    <View className={cx('mb-3 flex-row items-start justify-between gap-3', className)}>
      <View className="flex-1">
        <Text className={cx('font-headline-md text-headline-md font-semibold', tone === 'error' ? 'text-error' : 'text-on-surface')}>
          {title}
        </Text>
        {subtitle ? <Text className="mt-0.5 text-body-sm text-on-surface-variant">{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}
