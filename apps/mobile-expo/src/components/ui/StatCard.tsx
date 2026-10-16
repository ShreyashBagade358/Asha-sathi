import { Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { cx } from '@/cx';
import { shadow, toneClass, toneColor, type Tone } from '@/theme';

export type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: IconName;
  tone?: Tone;
};

/**
 * Consistent KPI tile matching the web dashboard:
 *   rounded-2xl border border-outline-variant/40 bg-surface-container-lowest
 *   p-4 shadow-card
 *
 * Layout uses fixed-height rows (not justify-between) so every card in a
 * row aligns regardless of label wrap or hint length:
 *   row 1: icon + label  (fixed 40px)
 *   row 2: big value     (fixed 40px)
 *   row 3: hint caption  (fixed 18px, clipped to 1 line)
 */
export function StatCard({ label, value, hint, icon, tone = 'primary' }: StatCardProps) {
  const t = toneClass(tone);
  return (
    <View
      className="flex-1 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4"
      style={shadow.card}
    >
      {/* Row 1: icon + label — fixed height so value always starts at same Y */}
      <View className={cx('h-10 flex-row items-start gap-2', t.fg)}>
        <Icon name={icon} size={18} color={toneColor[tone]} />
        <Text className="flex-1 font-label-sm text-label-sm font-semibold" numberOfLines={2}>
          {label}
        </Text>
      </View>

      {/* Row 2: the big number — fixed height */}
      <View className="mt-1 h-10 justify-center">
        <Text className="font-display-lg text-display-lg font-bold text-on-surface" numberOfLines={1}>
          {value}
        </Text>
      </View>

      {/* Row 3: hint — single line, ellipsis if too long */}
      <Text
        className="mt-1 font-caption text-caption text-on-surface-variant"
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {hint ?? ''}
      </Text>
    </View>
  );
}
