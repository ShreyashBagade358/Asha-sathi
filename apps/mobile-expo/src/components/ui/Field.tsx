import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { cx } from '@/cx';
import { colors } from '@/theme';

export type TextFieldProps = Omit<TextInputProps, 'className'> & {
  label?: string;
  errorText?: string;
  prefixIcon?: IconName;
  /** Renders a fixed left segment such as the +91 country code. */
  prefixText?: string;
  suffix?: string;
  /** Trailing glyph, e.g. the login screen's valid-number check. */
  suffixIcon?: IconName;
  suffixIconColor?: string;
  /** Makes the trailing glyph a button, e.g. the password reveal toggle. */
  onSuffixIconPress?: () => void;
  suffixIconLabel?: string;
};

export type PasswordFieldProps = Omit<TextFieldProps, 'secureTextEntry' | 'suffixIcon'> & {
  /** Label for the reveal control, e.g. "Show password". */
  showLabel?: string;
  hideLabel?: string;
};

/**
 * A password entry. The value is masked unless the user reveals it, and the
 * toggle is a real button with its own label so it is reachable by screen
 * readers rather than a bare glyph.
 */
export function PasswordField({ showLabel, hideLabel, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...rest}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="password"
      suffixIcon={visible ? 'eyeOff' : 'eye'}
      onSuffixIconPress={() => setVisible((v) => !v)}
      suffixIconLabel={visible ? hideLabel : showLabel}
    />
  );
}

/**
 * Matches the input styling used by the web's raw ASHA pages (AddNewPatient,
 * PatientDashboard search) rather than packages/design-system/react's ASHAInput,
 * whose camelCase utilities (bg-surfaceContainerLowest, text-onSurface) do not
 * exist in the web Tailwind config and therefore render unstyled.
 *
 *   h-touch-target rounded-lg border border-outline bg-surface px-4
 *   focus:border-primary
 */
export function TextField({
  label,
  errorText,
  prefixIcon,
  prefixText,
  suffix,
  suffixIcon,
  suffixIconColor,
  onSuffixIconPress,
  suffixIconLabel,
  style,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorText);

  const fieldCls = cx(
    'h-touch-target w-full rounded-lg border bg-surface px-4 text-on-surface',
    hasError ? 'border-error' : focused ? 'border-primary' : 'border-outline',
  );

  return (
    <View className="gap-1.5">
      {label ? <Text className="text-body-md text-on-surface">{label}</Text> : null}
      <View className="relative justify-center">
        {prefixIcon ? (
          <View className="absolute left-3 z-10">
            <Icon name={prefixIcon} size={18} color={colors.onSurfaceVariant} />
          </View>
        ) : null}
        {prefixText ? (
          <View className="absolute left-0 h-touch-target justify-center border-r border-outline-variant pl-4 pr-3">
            <Text className="text-body-md text-on-surface-variant">{prefixText}</Text>
          </View>
        ) : null}
        <TextInput
          placeholderTextColor={colors.outline}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          className={fieldCls}
          style={[
            prefixIcon ? { paddingLeft: 40 } : null,
            prefixText ? { paddingLeft: 68 } : null,
            suffix || suffixIcon ? { paddingRight: 52 } : null,
            style,
          ]}
          {...rest}
        />
        {suffixIcon ? (
          onSuffixIconPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={suffixIconLabel}
              onPress={onSuffixIconPress}
              hitSlop={12}
              className="absolute right-3"
            >
              <Icon name={suffixIcon} size={18} color={suffixIconColor ?? colors.onSurfaceVariant} />
            </Pressable>
          ) : (
            <View className="absolute right-4">
              <Icon name={suffixIcon} size={18} color={suffixIconColor ?? colors.onSurfaceVariant} />
            </View>
          )
        ) : null}
        {suffix ? (
          <Text className="absolute right-4 text-body-sm text-on-surface-variant" style={{ top: 16 }}>
            {suffix}
          </Text>
        ) : null}
      </View>
      {hasError ? <Text className="text-caption text-error">{errorText}</Text> : null}
    </View>
  );
}

export type SelectFieldProps = {
  label?: string;
  value: string;
  options: readonly { label: string; value: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  errorText?: string;
};

/**
 * Native RN has no styled <select>, so this is a bottom-sheet picker that
 * mirrors the web's custom chevron select:
 *   h-touch-target rounded-lg border border-outline bg-surface px-4
 */
export function SelectField({ label, value, options, onChange, placeholder, errorText }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const hasError = Boolean(errorText);

  return (
    <View className="gap-1.5">
      {label ? <Text className="text-body-md text-on-surface">{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen((o) => !o)}
        className={cx('h-touch-target w-full flex-row items-center justify-between rounded-lg border bg-surface px-4', hasError ? 'border-error' : 'border-outline')}
      >
        <Text className={selected ? 'text-body-md text-on-surface' : 'text-body-md text-outline'}>
          {selected?.label ?? placeholder ?? ''}
        </Text>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} color={colors.onSurfaceVariant} />
      </Pressable>
      {open ? (
        <View className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
          {options.map((o) => (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              onPress={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="h-touch-target justify-center border-b border-outline-variant/40 px-4 last:border-b-0"
            >
              <Text className={o.value === value ? 'text-body-md text-primary' : 'text-body-md text-on-surface'}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {hasError ? <Text className="text-caption text-error">{errorText}</Text> : null}
    </View>
  );
}
