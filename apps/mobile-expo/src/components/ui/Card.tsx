import type { ReactNode } from 'react';
import { Pressable, Text, View, type ViewProps } from 'react-native';

import { cx } from '@/cx';
import { shadow } from '@/theme';

export type CardProps = ViewProps & {
  children: ReactNode;
  /** Adds the web's shadow-card elevation. */
  elevated?: boolean;
  /** Left status rail, e.g. the 6px secondary rail on visit rows. */
  rail?: string;
  railWidth?: number;
};

export function Card({ children, elevated = true, rail, railWidth = 6, style, ...rest }: CardProps) {
  return (
    <View
      className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest"
      style={[elevated ? shadow.card : null, style]}
      {...rest}
    >
      {rail ? <View className="absolute left-0 top-0 bottom-0" style={{ width: railWidth, backgroundColor: rail }} /> : null}
      {children}
    </View>
  );
}

export type DividerProps = { inset?: number };

export function Divider({ inset = 0 }: DividerProps) {
  return <View className="h-px bg-outline-variant/40" style={{ marginLeft: inset }} />;
}

export type { SectionHeaderProps } from '@/components/ui/SectionHeader';
export { SectionHeader } from '@/components/ui/SectionHeader';

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

/** Mirrors the web's components/layout/PageHeader.tsx. */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <View className="mb-6 gap-3">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-headline-lg text-headline-lg text-on-surface">{title}</Text>
          {subtitle ? <Text className="mt-1 text-body-md text-on-surface-variant">{subtitle}</Text> : null}
        </View>
        {actions ? <View className="flex-row flex-wrap items-center gap-2">{actions}</View> : null}
      </View>
    </View>
  );
}

export type PillProps = {
  label: string;
  count?: number;
  active?: boolean;
  onPress?: () => void;
  /** Disables the press affordance for purely decorative chips. */
  disabled?: boolean;
};

export function Pill({ label, count, active = false, onPress, disabled = false }: PillProps) {
  const body = (
    <>
      <Text className={cx('font-label-md text-label-md', active ? 'text-on-primary' : 'text-on-surface-variant')}>{label}</Text>
      {count !== undefined ? (
        <View className={cx('rounded-full px-1.5', active ? 'bg-on-primary/20' : 'bg-surface-container-high')}>
          <Text className={cx('text-[11px] font-bold leading-4', active ? 'text-on-primary' : 'text-on-surface-variant')}>{count}</Text>
        </View>
      ) : null}
    </>
  );

  const cls = cx(
    'flex-row items-center gap-1.5 rounded-full px-3.5 py-2',
    active ? 'bg-primary' : 'bg-surface-container',
  );

  if (!onPress || disabled) {
    return (
      <View className={cls}>
        {body}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className={cls}>
      {body}
    </Pressable>
  );
}
