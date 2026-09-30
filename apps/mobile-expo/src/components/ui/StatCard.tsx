import { Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { shadow, toneClass, type Tone } from '@/theme';

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
 */
export function StatCard({ label, value, hint, icon, tone = 'primary' }: StatCardProps) {
  const t = toneClass(tone);
  return (
    <View className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4" style={shadow.card}>
      <View className={`flex-row items-center gap-2 ${t.fg}`}>
        <Icon name={icon} size={20} />
        <Text className="font-label-md text-label-md">{label}</Text>
      </View>
      <Text className="mt-3 font-display-lg text-display-lg text-on-surface">{value}</Text>
      {hint ? <Text className="font-caption text-caption text-on-surface-variant">{hint}</Text> : null}
    </View>
  );
}
