import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { cx } from '@/cx';
import { useLocalization } from '@/i18n/useLocalization';
import { BOTTOM_NAV, type NavBadge } from '@/nav/config';
import { colors } from '@/theme';

export type TabBadges = Record<NonNullable<NavBadge>, number>;

/**
 * Port of MobileBottomNav in
 * apps/web-dashboard/src/components/layout/AdminLayout.tsx:
 *   fixed bottom-0 flex items-center justify-around
 *   border-t border-outline-variant/40 bg-surface-container-low px-2 py-2
 *   item: flex flex-col items-center gap-1 rounded-xl px-3 py-1.5
 *         active bg-primary-container text-on-primary-container
 *   icon 22, label font-caption text-[11px] font-semibold
 *
 * The web renders a bare dot for any non-zero badge and discards the number it
 * already computed; mobile shows the real count, which is the reason for
 * computing it locally. The overflow ("More") destinations live in the top app
 * bar's sheet rather than a sixth tab, matching the web's 5-item bottom nav.
 */
export function TabBar({ state, badges }: { state: { index: number }; badges: TabBadges }) {
  const insets = useSafeAreaInsets();
  const { t } = useLocalization();
  const router = useRouter();

  return (
    <View
      className="flex-row items-center justify-around border-t border-outline-variant/40 bg-surface-container-low px-2 py-2"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      {BOTTOM_NAV.map((item, index) => {
        const focused = state.index === index;
        const count = item.badge ? badges[item.badge] : 0;
        return (
          <Pressable
            key={item.path}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={t(item.labelKey)}
            onPress={() => router.replace(item.path as never)}
            className={cx('flex-1 flex-col items-center gap-1 rounded-xl px-3 py-1.5', focused ? 'bg-primary-container' : 'bg-transparent')}
          >
            <View>
              <Icon name={item.icon} size={22} color={focused ? colors.onPrimaryContainer : colors.onSurfaceVariant} />
              {count > 0 ? (
                <View
                  className="absolute -right-3 -top-1 min-w-4 items-center justify-center rounded-full border border-surface-container-low px-1"
                  style={{ backgroundColor: item.badgeTone === 'danger' ? colors.error : colors.secondary }}
                >
                  <Text className="text-[9px] font-bold leading-3 text-on-primary">{count > 99 ? '99+' : count}</Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              className={cx('text-[11px] font-semibold', focused ? 'text-on-primary-container' : 'text-on-surface-variant')}
            >
              {t(item.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
