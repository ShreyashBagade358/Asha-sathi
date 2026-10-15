import { useState, type ReactNode } from 'react';
import { Pressable, Text, View, type ViewProps } from 'react-native';
import { router } from 'expo-router';

import { cx } from '@/cx';
import { Icon } from '@/components/ui/Icon';
import { useLocalization } from '@/i18n/useLocalization';
import { colors, shadow } from '@/theme';

export type CardProps = ViewProps & {
  children: ReactNode;
  /** Adds the web's shadow-card elevation. */
  elevated?: boolean;
  /** Left status rail, e.g. the 6px secondary rail on visit rows. */
  rail?: string;
  railWidth?: number;
};

export function Card({ children, elevated = true, rail, railWidth = 6, style, className, ...rest }: CardProps) {
  return (
    <View
      className={cx('rounded-2xl border border-outline-variant/40 bg-surface-container-lowest', className)}
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
  /** Renders the back chevron before the title (stack screens). */
  back?: boolean;
  onBack?: () => void;
};

/** Mirrors the web's components/layout/PageHeader.tsx. */
export function PageHeader({ title, subtitle, actions, back, onBack }: PageHeaderProps) {
  const { t } = useLocalization();
  return (
    <View className="mb-6 gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={onBack ?? (() => router.back())}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full bg-surface-container"
          >
            <Icon name="chevronLeft" size={22} color={colors.onSurface} />
          </Pressable>
        ) : null}
        <View className="min-w-0 flex-1">
          <Text
            className="font-headline-lg text-headline-lg text-on-surface"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              className="mt-1 text-body-md text-on-surface-variant"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actions ? <View className="flex-row shrink-0 items-center gap-2">{actions}</View> : null}
      </View>
    </View>
  );
}

export type PillProps = {
  label: string;
  count?: number;
  active?: boolean;
  onPress?: () => void;
  /** Renders the pill inert (and dimmed) for purely decorative chips. */
  disabled?: boolean;
};

export function Pill({ label, count, active = false, onPress, disabled = false }: PillProps) {
  const [pressed, setPressed] = useState(false);
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

  // min-h-11: py-2 over a label-md line is 36px on its own, under the 44pt
  // target; the padding keeps its position so the pill only grows in height.
  const cls = cx(
    'min-h-11 flex-row items-center gap-1.5 rounded-full px-3.5 py-2',
    active ? 'bg-primary' : 'bg-surface-container',
    !active && pressed && 'bg-surface-container-high',
    disabled && 'opacity-60',
  );

  if (!onPress || disabled) {
    return (
      <View className={cls}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className={cls}
    >
      {body}
    </Pressable>
  );
}
