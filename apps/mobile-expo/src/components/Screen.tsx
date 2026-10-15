import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/LanguageToggle';
import { PageHeader } from '@/components/ui/Card';
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
  /**
   * Apply the top safe-area inset. Set false when the parent navigator already
   * pads the scene (the tab layout's `sceneStyle.paddingTop`) — otherwise the
   * header is pushed down twice and sits oddly below the status bar.
   */
  safeAreaTop?: boolean;
  /**
   * `'bar'` (default) is the 56px app bar. `'page'` drops that bar and renders
   * the tab pages' `PageHeader` (headline-lg title + subtitle) as the first
   * element of the scroll content instead, so stack screens like the
   * registration form read exactly like Dashboard / Patients / Households.
   */
  header?: 'bar' | 'page';
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
  safeAreaTop = true,
  header = 'bar',
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLocalization();
  const [online, setOnline] = useState(() => isCurrentlyOnline());

  useEffect(() => subscribeOnline(setOnline), []);

  const onlinePill = (
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
  );

  // Page-mode header: the same big title block the tab pages use, with the
  // online/offline pill kept in the action row.
  const pageHeader =
    header === 'page' && title ? (
      <PageHeader
        back={back}
        onBack={onBack}
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {showStatus ? onlinePill : null}
            {actions}
          </>
        }
      />
    ) : null;

  const body = scroll ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        className={cx('flex-1', className)}
        style={{ flex: 1 }}
        // Either-or, not both: `pb-8 pb-28` in one string relies on Tailwind's
        // utility ordering to pick the winner, which silently drops the tab-bar
        // clearance if that order ever changes.
        contentContainerClassName={cx(withTabBar ? 'pb-28' : 'pb-8', 'px-4', contentClassName)}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {pageHeader}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  ) : (
    <View className={cx('flex-1', className)}>
      {pageHeader}
      {children}
    </View>
  );

  return (
    <View className="flex-1 bg-background" style={safeAreaTop ? { paddingTop: insets.top } : undefined}>
      {header === 'bar' ? (
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
              <Text
                className="font-headline-lg text-headline-lg text-on-surface"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text
                  className="font-caption text-caption text-on-surface-variant"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : (
            <View className="flex-1" />
          )}
          {showStatus ? onlinePill : null}
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
      ) : null}
      {body}
    </View>
  );
}
