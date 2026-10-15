import { useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { cx } from '@/cx';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';
import { dateToIso, isoToDate, isoToDisplay } from '@/utils/date';

export type TextFieldProps = Omit<TextInputProps, 'className'> & {
  label?: string;
  errorText?: string;
  /**
   * Merged into the input's own classes rather than replacing them (a spread
   * after the base className would wipe the border/background).
   */
  className?: string;
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
  /** Reveal label when shown; defaults to t('auth.showPassword'). */
  showLabel?: string;
  /** Mask label when revealed; defaults to t('auth.hidePassword'). */
  hideLabel?: string;
};

/**
 * A password entry. The value is masked unless the user reveals it, and the
 * toggle is a real button with its own label so it is reachable by screen
 * readers rather than a bare glyph - which is why the label falls back to the
 * auth strings instead of silently rendering an unlabelled button.
 */
export function PasswordField({ showLabel, hideLabel, ...rest }: PasswordFieldProps) {
  const { t } = useLocalization();
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
      suffixIconLabel={visible ? (hideLabel ?? t('auth.hidePassword')) : (showLabel ?? t('auth.showPassword'))}
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
  className,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorText);

  // Caller className appends to the base; it must not replace it (a spread
  // after this prop would wipe the border/background and render a bare input).
  // The same ordering rule applies to the TextInput itself: `{...rest}` is
  // spread first so a caller-supplied onFocus/onBlur is *called* by the
  // wrappers below rather than replacing them (which would freeze the border
  // in its unfocused state), while className/style still win over rest.
  const fieldCls = cx(
    'h-touch-target w-full rounded-lg border bg-surface px-4 text-body-md text-on-surface',
    hasError ? 'border-error' : focused ? 'border-primary' : 'border-outline',
    className,
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
          // z-10 keeps the prefix above the TextInput's opaque surface
          // background (same reason prefixIcon uses z-10).
          <View className="absolute left-0 z-10 h-touch-target justify-center border-r border-outline-variant pl-4 pr-3">
            <Text className="text-body-md text-on-surface-variant">{prefixText}</Text>
          </View>
        ) : null}
        <TextInput
          {...rest}
          placeholderTextColor={rest.placeholderTextColor ?? colors.outline}
          accessibilityLabel={rest.accessibilityLabel ?? label}
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
        />
        {suffixIcon ? (
          onSuffixIconPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={suffixIconLabel}
              onPress={onSuffixIconPress}
              // 18px glyph + 2*14 keeps the reveal button's hit area at 46px.
              hitSlop={14}
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
  /** Always show the search box, even for short lists (e.g. household ID). */
  searchable?: boolean;
};

/**
 * Native RN has no styled <select>, so this opens a bottom-sheet picker with
 * the web's chevron select styling:
 *   h-touch-target rounded-lg border border-outline bg-surface px-4
 *
 * The options live in a Modal, not inline: expanding them inside the form
 * made the hosting card grow and overlap the rest of the form.
 */

/**
 * One option row: `h-touch-target` (48px) includes its 1px bottom border
 * (RN measures like border-box), so every row has the same pitch - which is
 * what lets the list hand VirtualizedList an exact `getItemLayout` and open
 * at the right scroll offset instead of rendering blank in the modal.
 */
const OPTION_ROW_HEIGHT = 48;

export function SelectField({ label, value, options, onChange, placeholder, errorText, searchable }: SelectFieldProps) {
  const { t } = useLocalization();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const hasError = Boolean(errorText);

  // Lists like the village select carry thousands of rows (Pune alone has
  // ~1900); the FlatList virtualises them and the filter keeps a single
  // village findable without scrolling.
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;
  const filtered = searchable || options.length > 30;

  return (
    <View className="gap-1.5">
      {label ? <Text className="text-body-md text-on-surface">{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        className={cx('h-touch-target w-full flex-row items-center justify-between gap-2 rounded-lg border bg-surface px-4', hasError ? 'border-error' : 'border-outline')}
      >
        <Text numberOfLines={1} className={cx('flex-1', selected ? 'text-body-md text-on-surface' : 'text-body-md text-outline')}>
          {selected?.label ?? placeholder ?? ''}
        </Text>
        <Icon name="chevronDown" size={18} color={colors.onSurfaceVariant} />
      </Pressable>
      <Modal visible={open} onClose={() => setOpen(false)} title={label}>
        {filtered ? (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            accessibilityLabel={label}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            className="mb-2 h-touch-target rounded-lg border border-outline bg-surface px-4 text-body-md text-on-surface"
          />
        ) : null}
        <FlatList
          data={visible}
          keyExtractor={(option) => option.value}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={24}
          maxToRenderPerBatch={40}
          windowSize={10}
          getItemLayout={(_, index) => ({
            length: OPTION_ROW_HEIGHT,
            offset: OPTION_ROW_HEIGHT * index,
            index,
          })}
          style={{ maxHeight: filtered ? 384 : 432 }}
          ListEmptyComponent={
            // A filter that matches nothing must not repeat the picker
            // placeholder ("Select village" under a blank list reads as a
            // broken dropdown); an untouched-but-empty option list keeps it.
            <Text className="px-1 py-3 text-body-md text-on-surface-variant">
              {needle ? t('common.noResults') : (placeholder ?? '')}
            </Text>
          }
          renderItem={({ item: option }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: option.value === value }}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={{ height: OPTION_ROW_HEIGHT }}
              className="flex-row items-center justify-between gap-2 border-b border-outline-variant/40 px-1"
            >
              <Text numberOfLines={1} className={cx('flex-1', option.value === value ? 'text-body-md text-primary' : 'text-body-md text-on-surface')}>
                {option.label}
              </Text>
              {option.value === value ? <Icon name="check" size={18} color={colors.primary} /> : null}
            </Pressable>
          )}
        />
      </Modal>
      {hasError ? <Text className="text-caption text-error">{errorText}</Text> : null}
    </View>
  );
}

export type DateFieldProps = {
  label?: string;
  /** Selected date as ISO YYYY-MM-DD; '' when unset. */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  errorText?: string;
  /** Earliest selectable date (ISO). Defaults to 1900-01-01. */
  minIso?: string;
  /** Latest selectable date (ISO). Defaults to today. */
  maxIso?: string;
  /** Confirm button label for the iOS wheel sheet; defaults to t('common.done'). */
  doneLabel?: string;
};

/**
 * Date entry that presets the display format to DD/MM/YYYY and opens the
 * system picker instead of asking anyone to type YYYY-MM-DD. The value stays
 * ISO so the DB's `date()` arithmetic and the server keep working unchanged.
 *
 * Platform behaviour differs: mounting the component on Android opens the
 * native calendar dialog, while iOS renders wheels, so the wheel variant
 * lives in the app's bottom sheet behind a Done button.
 */
export function DateField({ label, value, onChange, placeholder, errorText, minIso, maxIso, doneLabel }: DateFieldProps) {
  const { t } = useLocalization();
  const [open, setOpen] = useState(false);
  const hasError = Boolean(errorText);
  const min = isoToDate(minIso ?? '1900-01-01') ?? new Date(1900, 0, 1);
  const max = isoToDate(maxIso ?? dateToIso(new Date())) ?? new Date();
  const selected = isoToDate(value);
  const initial = selected && selected >= min && selected <= max ? selected : new Date(2000, 0, 1);
  const display = isoToDisplay(value);

  return (
    <View className="gap-1.5">
      {label ? <Text className="text-body-md text-on-surface">{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        className={cx(
          'h-touch-target w-full flex-row items-center justify-between gap-2 rounded-lg border bg-surface px-4',
          hasError ? 'border-error' : 'border-outline',
        )}
      >
        <View className="flex-1 flex-row items-center gap-2">
          <Icon name="calendar" size={18} color={colors.onSurfaceVariant} />
          <Text numberOfLines={1} className={cx('text-body-md', display ? 'text-on-surface' : 'text-outline')}>
            {display || placeholder || 'DD/MM/YYYY'}
          </Text>
        </View>
      </Pressable>

      {/* Android: mounting the component opens the native dialog. */}
      {open && Platform.OS !== 'ios' ? (
        <DateTimePicker
          value={initial}
          mode="date"
          display="calendar"
          minimumDate={min}
          maximumDate={max}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === 'set' && date) onChange(dateToIso(date));
          }}
        />
      ) : null}

      {/* iOS: the wheels need a host, so they live in the bottom sheet. */}
      {open && Platform.OS === 'ios' ? (
        <Modal visible onClose={() => setOpen(false)} title={label}>
          <DateTimePicker
            value={initial}
            mode="date"
            display="spinner"
            minimumDate={min}
            maximumDate={max}
            onChange={(_, date) => {
              if (date) onChange(dateToIso(date));
            }}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            className="h-touch-target items-center justify-center rounded-lg bg-primary px-4"
          >
            <Text className="text-body-md font-semibold text-on-primary">{doneLabel ?? t('common.done')}</Text>
          </Pressable>
        </Modal>
      ) : null}

      {hasError ? <Text className="text-caption text-error">{errorText}</Text> : null}
    </View>
  );
}
