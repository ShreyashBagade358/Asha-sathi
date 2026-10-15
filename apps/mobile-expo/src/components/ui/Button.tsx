import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { cx } from '@/cx';
import { colors, shadow } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'error' | 'ghost';
export type ButtonShape = 'pill' | 'rounded';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  shape?: ButtonShape;
  icon?: IconName;
  loading?: boolean;
  full?: boolean;
  /**
   * Merged into the button's own classes (flex-1, mt-4, ...). It must not
   * *replace* them: a caller className prop spread after the base className
   * used to wipe out bg-primary/h-touch-target/px-5, rendering a white,
   * boxless button.
   */
  className?: string;
};

const VARIANT_CLS: Record<ButtonVariant, { base: string; text: string }> = {
  // Web login submit: h-[48px] rounded-lg bg-primary ... shadow-sm active:scale-[0.98]
  primary: { base: 'bg-primary', text: 'text-on-primary' },
  secondary: { base: 'bg-primary-container', text: 'text-on-primary' },
  error: { base: 'bg-error', text: 'text-on-error' },
  // Web outline action (AddNewPatient's Cancel): rounded-full text-primary,
  // no border and no fill - just the label in the primary colour.
  ghost: { base: 'bg-transparent', text: 'text-primary' },
};

export function Button({
  label,
  variant = 'primary',
  shape = 'rounded',
  icon,
  loading = false,
  full = false,
  disabled,
  onPressIn,
  onPressOut,
  className,
  ...rest
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const v = VARIANT_CLS[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: loading }}
      disabled={isDisabled}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      className={cx(
        'h-touch-target flex-row items-center justify-center gap-2 px-5',
        shape === 'pill' ? 'rounded-full' : 'rounded-lg',
        v.base,
        full ? 'w-full' : 'self-start',
        isDisabled && 'opacity-60',
        // Caller extras (flex-1, mt-4) append to - never replace - the base.
        className,
      )}
      style={[
        variant !== 'ghost' ? shadow.card : null,
        // Web uses active:scale-[0.98] on the login submit.
        pressed && !isDisabled ? { transform: [{ scale: 0.98 }] } : null,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'ghost' ? colors.primary : colors.onPrimary} />
      ) : icon ? (
        <Icon name={icon} size={18} color={variant === 'ghost' ? colors.primary : colors.onPrimary} />
      ) : null}
      <Text className={cx('font-label-md text-label-md', v.text)}>{label}</Text>
    </Pressable>
  );
}

export type IconButtonProps = {
  name: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  background?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  className?: string;
};

/** The 44x44 circular icon buttons used in list rows and the top bar. */
export function IconButton({ name, onPress, size = 20, color = colors.onSurfaceVariant, background = colors.surfaceContainer, accessibilityLabel, disabled = false, className }: IconButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className={cx('h-11 w-11 items-center justify-center rounded-full', disabled && 'opacity-60', pressed && !disabled && 'bg-surface-container-high', className)}
      style={{ backgroundColor: pressed && !disabled ? undefined : background }}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

/** The web's "View All →" text affordance. */
export type RiskChipProps = {
  level: 'low' | 'medium' | 'high';
  label: string;
};

/**
 * Risk chip colours are copied from PatientDashboardAshaSathi's riskChip map,
 * including the medium tier's custom #FF8C00 / #B34E00 pair, which is not part
 * of the Material palette.
 */
const RISK_CLS = {
  low: { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer, icon: 'checkCircle' as IconName },
  medium: { bg: '#FF8C0026', fg: '#B34E00', icon: 'alert' as IconName },
  high: { bg: colors.errorContainer, fg: colors.onErrorContainer, icon: 'alert' as IconName },
};

export function RiskChip({ level, label }: RiskChipProps) {
  const c = RISK_CLS[level];
  return (
    <View
      className="flex-row items-center gap-1 self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: c.bg }}
    >
      <Icon name={c.icon} size={12} color={c.fg} />
      <Text className="font-caption text-caption" style={{ color: c.fg }}>
        {label}
      </Text>
    </View>
  );
}
