import { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { cx } from '@/cx';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

export type SearchBarProps = Omit<TextInputProps, 'className' | 'value' | 'onChangeText' | 'onSubmitEditing'> & {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  /**
   * Merged into the input's own classes rather than replacing them (a spread
   * after the base className would wipe the border/background).
   */
  className?: string;
};

/**
 * The list search field from PatientDashboardAshaSathi:
 *   h-touch-target w-full rounded-lg border border-outline
 *   bg-surface-container-lowest pl-10 pr-4 text-on-surface focus:border-primary
 * with the glyph pinned at left-3.5 (14px).
 *
 * A non-empty query gets the standard clear (x) affordance at the right; the
 * trailing control is a 44pt hit area (18px glyph + 2*13 hitSlop) and clears
 * through the same onChangeText the caller already owns, so no extra prop.
 */
export function SearchBar({ value, onChangeText, placeholder, onSubmit, className, style, ...rest }: SearchBarProps) {
  const { t } = useLocalization();
  const [focused, setFocused] = useState(false);
  const hasQuery = value.length > 0;

  return (
    <View className="relative w-full justify-center">
      <View className="absolute left-[14px] z-10">
        <Icon name="search" size={18} color={colors.onSurfaceVariant} />
      </View>
      {/* `{...rest}` first: spread after onFocus/onBlur would let a caller's
          handler replace the wrapper and freeze the border unfocused. Only the
          props that must win are re-declared below. */}
      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={rest.accessibilityLabel ?? placeholder}
        placeholderTextColor={rest.placeholderTextColor ?? colors.onSurfaceVariant}
        returnKeyType={rest.returnKeyType ?? 'search'}
        onSubmitEditing={onSubmit ? () => onSubmit() : undefined}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        className={cx(
          'h-12 w-full rounded-lg border bg-surface-container-lowest pl-10 text-on-surface focus:border-primary',
          hasQuery ? 'pr-10' : 'pr-4',
          focused ? 'border-primary' : 'border-outline',
          className,
        )}
        style={style}
      />
      {hasQuery ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.clear')}
          onPress={() => onChangeText('')}
          hitSlop={13}
          className="absolute right-3 h-6 w-6 items-center justify-center rounded-full"
        >
          <Icon name="x" size={16} color={colors.onSurfaceVariant} />
        </Pressable>
      ) : null}
    </View>
  );
}
