import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { cx } from '@/cx';
import { colors } from '@/theme';

export type SearchBarProps = Omit<TextInputProps, 'className' | 'value' | 'onChangeText' | 'onSubmitEditing'> & {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
};

/**
 * The list search field from PatientDashboardAshaSathi:
 *   h-touch-target w-full rounded-lg border border-outline
 *   bg-surface-container-lowest pl-10 pr-4 text-on-surface focus:border-primary
 * with the glyph pinned at left-3.5 (14px).
 */
export function SearchBar({ value, onChangeText, placeholder, onSubmit, style, ...rest }: SearchBarProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="relative w-full justify-center">
      <View className="absolute left-[14px] z-10">
        <Icon name="search" size={18} color={colors.onSurfaceVariant} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant}
        returnKeyType="search"
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
          'h-12 w-full rounded-lg border bg-surface-container-lowest pl-10 pr-4 text-on-surface focus:border-primary',
          focused ? 'border-primary' : 'border-outline',
        )}
        style={style}
        {...rest}
      />
    </View>
  );
}
