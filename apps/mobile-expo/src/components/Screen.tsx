import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/cx';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

export type ScreenProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Renders a back affordance instead of the More button. */
  back?: boolean;
  onBack?: () => void;
  /** Extra actions in the top bar (language toggle, notifications, logout). */
  actions?: ReactNode;
  /** Set false for screens that manage their own scrolling (lists, tabs). */
  scroll?: boolean;
  /** Bottom padding for the tab bar. Screens without it default to true. */
  withTabBar?: boolean;
  className?: string;
  contentClassName?: string;
};

/**
 * Shared page chrome: the top app bar, safe-area insets, the EN/hi toggle, and
 * the bottom padding that clears the tab bar.
 *
 * On the web the language toggle lives in the AdminLayout's user menu and the
 * online/offline state in its top-bar chip; both are surfaced here so a phone
 * user has the same controls.
 */
export function Screen({
  children,
  title,
  subtitle,
  back = false,
  onBack,
  actions,
  scroll = true,
  withTabBar = true,
  className,
  contentClassName,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLocalization();

  const body = scroll ? (
    <ScrollView
      className={cx('flex-1', className)}
      contentContainerClassName={cx('px-4 pb-8', withTabBar && 'pb-28')}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View className={cx('flex-1', className)}>{children}</View>
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2 bg-primary px-4 pb-3 pt-2">
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={onBack ?? (() => router.back())}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center"
          >
            <Icon name="chevronLeft" size={22} color={colors.onPrimary} />
          </Pressable>
        ) : null}
        {title ? (
          <View className="flex-1">
            <Text className="font-headline-md text-headline-md text-on-primary" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="font-caption text-caption text-primary-fixed" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="flex-1" />
        )}
        {actions}
        <LanguageToggle />
      </View>
      {body}
    </View>
  );
}
