import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { cx } from '@/cx';
import { toneClass, type Tone } from '@/theme';

export type ListRowProps = {
  /** Glyph placed inside the round avatar; falls back to the title's initial. */
  avatar?: ReactNode;
  avatarTone?: Tone;
  title: string;
  subtitle?: string;
  /** Third line, e.g. "ABHA • 28 yrs • Rampur". */
  meta?: string;
  /** Trailing slot: chevron, chip, count, ... */
  right?: ReactNode;
  /** Bottom hairline. Pass false for the last row of a list. */
  divider?: boolean;
  /** Suppresses the divider regardless of `divider` (last row). */
  isLast?: boolean;
  onPress?: () => void;
  dimmed?: boolean;
  className?: string;
};

/**
 * The row used by PatientDashboardAshaSathi / TasksAshaSathi /
 * NotificationsAshaSathi list cards:
 *   flex items-center gap-3 p-4 (+ border-b border-outline-variant/40)
 *   hover:bg-surface-container, avatar h-12 w-12 rounded-full bg-primary-container
 *   title font-label-md text-label-md font-semibold text-on-surface
 *   meta  font-caption text-caption text-on-surface-variant
 */
export function ListRow({
  avatar,
  avatarTone = 'primary',
  title,
  subtitle,
  meta,
  right,
  divider = true,
  isLast = false,
  onPress,
  dimmed = false,
  className,
}: ListRowProps) {
  const [pressed, setPressed] = useState(false);
  const tone = toneClass(avatarTone);

  const body = (
    <>
      <View className={cx('h-12 w-12 shrink-0 items-center justify-center rounded-full', tone.container)}>
        {avatar ?? <Text className={cx('font-label-md text-label-md font-semibold', tone.onContainer)}>{title.charAt(0).toUpperCase()}</Text>}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-label-md text-label-md font-semibold text-on-surface" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="font-caption text-caption text-on-surface-variant" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text className="font-caption text-caption text-on-surface-variant" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {right ? <View className="shrink-0 flex-row items-center gap-2">{right}</View> : null}
    </>
  );

  const rowCls = cx(
    'flex-row items-center gap-3 p-4',
    divider && !isLast ? 'border-b border-outline-variant/40' : null,
    dimmed ? 'opacity-60' : null,
    className,
  );

  if (!onPress) {
    return <View className={rowCls}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className={cx(rowCls, pressed && 'bg-surface-container')}
      style={pressed ? { transform: [{ scale: 0.99 }] } : null}
    >
      {body}
    </Pressable>
  );
}
