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
 * Port of the KPI tile in AshaWorkerHomeAshaSathi.tsx:
 *   rounded-2xl border border-outline-variant/40 bg-surface-container-lowest
 *   p-4 shadow-card
 * with the icon+label row tinted by tone, then the display-lg value and caption hint.
 *
 * The glyph is tinted with toneColor[tone] rather than left on Icon's default:
 * a Feather glyph reads its own `color` prop, so inside a text-coloured row it
 * would otherwise stay grey while the label beside it turns primary/secondary.
 */
export function StatCard({ label, value, hint, icon, tone = 'primary' }: StatCardProps) {
  const t = toneClass(tone);
  return (
    <View className="flex-1 h-[120px] justify-between rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4" style={shadow.card}>
      <View className={cx('flex-row items-start gap-2', t.fg)}>
        <Icon name={icon} size={20} color={toneColor[tone]} />
        <Text className="flex-1 font-label-md text-label-md" numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text className="mt-3 font-display-lg text-display-lg font-bold text-on-surface" numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text className="font-caption text-caption text-on-surface-variant" numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
