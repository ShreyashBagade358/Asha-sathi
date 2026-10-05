import { Pressable } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { cx } from '@/cx';

export type FABProps = {
  onPress: () => void;
  icon?: IconName;
  /** Distance from the bottom edge; defaults to clearing the tab bar (bottom-28). */
  bottomOffset?: number;
  accessibilityLabel?: string;
  className?: string;
};

/**
 * The floating add button from AssignedHouseholdsAshaSathi:
 *   fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center
 *   rounded-xl bg-primary text-on-primary shadow-lg active:scale-95
 * (web uses bottom-24; bottom-28 clears this app's taller tab bar).
 */
export function FAB({ onPress, icon = 'plus', bottomOffset, accessibilityLabel, className }: FABProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={cx('absolute right-6 bottom-28 h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg active:scale-95', className)}
      style={bottomOffset !== undefined ? { bottom: bottomOffset } : null}
    >
      <Icon name={icon} size={24} color="#ffffff" />
    </Pressable>
  );
}
