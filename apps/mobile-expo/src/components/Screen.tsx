import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/cx';
import { useLocalization } from '@/i18n/useLocalization';
import { isCurrentlyOnline, subscribeOnline } from '@/sync/network';
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
  /** Hide the online/offline pill (screens with their own status row). */
  showStatus?: boolean;
  /** Unread notification count for the bell; wire it from a query, never hardcode. */
  badgeCount?: number;
  onBadgePress?: () => void;
};

/**
 * Shared page chrome: the top app bar, safe-area insets, the EN/hi toggle, and
 * the bottom padding that clears the tab bar.
 *
 * The bar mirrors the web AdminLayout's mobile header: a surface-coloured
 * `min-h-[56px] px-4 py-2 border-b border-outline-variant` row carrying the
 * headline-md title, the online/offline pill from sync/network, and the
 * notification bell. The language toggle stays here because the web keeps it
 * in the user menu, which a phone has no room for.
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
  showStatus = true,
  badgeCount,
  onBadgePress,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLocalization();
  const [online, setOnline] = useState(() => isCurrentlyOnline());

  useEffect(() => subscribeOnline(setOnline), []);

  const body = scroll ? (
    <ScrollView
      className={cx('flex-1', className)}
      contentContainerClassName={cx('px-4 pb-8', withTabBar && 'pb-28', contentClassName)}
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
      <View className="min-h-[56px] flex-row items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-4 py-2">
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={onBack ?? (() => router.back())}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center"
          >
            <Icon name="chevronLeft" size={22} color={colors.onSurface} />
          </Pressable>
        ) : null}
        {title ? (
          <View className="min-w-0 flex-1">
            <Text className="font-headline-md text-headline-md text-on-surface" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="font-caption text-caption text-on-surface-variant" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="flex-1" />
        )}
        {showStatus ? (
          <View
            className={cx(
              'flex-row items-center gap-1.5 rounded-full px-3 py-1.5',
              online ? 'bg-secondary-container/60' : 'bg-error-container',
            )}
          >
            <View className={cx('h-2 w-2 rounded-full', online ? 'bg-secondary' : 'bg-error')} />
            <Text
              className={cx(
                'font-label-md text-label-md',
                online ? 'text-on-secondary-container' : 'text-on-error-container',
              )}
              numberOfLines={1}
            >
              {online ? t('nav.online') : t('nav.offline')}
            </Text>
          </View>
        ) : null}
        {actions}
        {badgeCount !== undefined || onBadgePress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('nav.notifications')}
            onPress={onBadgePress}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center"
          >
            <Icon name="bell" size={22} color={colors.onSurface} />
            {badgeCount ? (
              <View className="absolute right-1 top-1 h-4 min-w-4 items-center justify-center rounded-full bg-error px-1">
                <Text className="text-[10px] font-bold text-on-error">{badgeCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
        <LanguageToggle onSurface />
      </View>
      {body}
    </View>
  );
}
