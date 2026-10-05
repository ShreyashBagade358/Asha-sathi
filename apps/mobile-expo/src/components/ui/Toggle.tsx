import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { cx } from '@/cx';

export type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/**
 * The role="switch" control from HouseholdVisitSurveyAshaSathi:
 *   track: relative h-7 w-12 rounded-full, bg-secondary when on / bg-outline-variant off
 *   knob:  h-6 w-6 rounded-full bg-white shadow-sm, left-[22px] on / left-0.5 off
 *
 * The knob slides with RN's Animated (not Reanimated) so it also runs under
 * Jest, where Reanimated is stubbed out.
 */
export function Toggle({ value, onValueChange, disabled = false, accessibilityLabel }: ToggleProps) {
  const slide = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [value, slide]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      className={cx('h-7 w-12 shrink-0 rounded-full', value ? 'bg-secondary' : 'bg-outline-variant', disabled && 'opacity-50')}
    >
      <Animated.View
        className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm"
        style={{
          transform: [
            {
              translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }),
            },
          ],
        }}
      />
    </Pressable>
  );
}
