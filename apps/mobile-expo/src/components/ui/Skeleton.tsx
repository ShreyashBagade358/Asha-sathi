import { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { cx } from '@/cx';

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  /** Corner radius; defaults to 8. */
  rounded?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Shimmering placeholder block (the web's pulse-subtle cards). NativeWind does
 * not run CSS keyframes, so the pulse is an RN opacity loop.
 */
export function Skeleton({ width = '100%', height = 16, rounded = 8, className, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      // Purely decorative shimmer: it stands in for content that has not
      // loaded, so screen readers should skip it rather than announce an
      // empty block.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cx('bg-surface-container-high', className)}
      style={[{ width, height, borderRadius: rounded, opacity: pulse }, style]}
    />
  );
}
