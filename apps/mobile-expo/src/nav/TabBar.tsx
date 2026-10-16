import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { useLocalization } from '@/i18n/useLocalization';
import { BOTTOM_NAV, type NavBadge, type NavItem } from '@/nav/config';
import { colors } from '@/theme';

/** Deep Indigo sidebar colour — always dark, same in light & dark themes. */
const TAB_BAR_BG = '#242B65';
const TAB_ACTIVE_BG = 'rgba(255,255,255,0.15)';
const TAB_INACTIVE_ICON = '#94A3B8';

export type TabBadges = Record<NonNullable<NavBadge>, number>;

/**
 * Port of MobileBottomNav in
 * apps/web-dashboard/src/components/layout/AdminLayout.tsx:
 *   fixed bottom-0 w-full items-center justify-around
 *   border-t border-outline-variant/40 bg-surface-container-low px-2 py-2
 *   item: flex flex-col items-center gap-1 rounded-full px-4 py-1.5
 *         active bg-primary-container text-on-primary-container font-bold
 *         inactive text-on-surface-variant active:scale-90
 *   icon 22, label text-[11px] font-semibold
 *   badge: absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border
 *
 * `fixed bottom-0 w-full` needs no `position` in React Native: the tab
 * navigator lays the bar out in flow at the bottom of a column, which is
 * exactly what `fixed` does on the web, so `w-full` is the only translation.
 *
 * The web renders a bare dot for any non-zero badge and discards the number it
 * already computed; mobile keeps the dot (web parity) but hands the count to
 * assistive tech through `accessibilityValue`, so a screen reader still hears
 * "3" while the pixel treatment matches the dashboard. The overflow ("More")
 * destinations live in the top app bar's sheet rather than a sixth tab,
 * matching the web's 5-item bottom nav.
 */
export function TabBar({
  state,
  badges,
  items = BOTTOM_NAV,
}: {
  state: { index: number };
  badges?: Partial<TabBadges>;
  items?: NavItem[];
}) {
  const insets = useSafeAreaInsets();
  const { t } = useLocalization();
  const router = useRouter();

  return (
    <View
      className="w-full flex-row items-center justify-around px-2 py-2"
      style={{
        backgroundColor: TAB_BAR_BG,
        borderTopColor: 'rgba(255,255,255,0.08)',
        borderTopWidth: 1,
        paddingBottom: Math.max(insets.bottom, 8),
      }}
    >
      {items.map((item, index) => {
        const focused = state.index === index;
        const count = item.badge ? (badges?.[item.badge] ?? 0) : 0;
        return (
          <Pressable
            key={item.path}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={t(item.labelKey)}
            accessibilityValue={count > 0 ? { text: String(count) } : undefined}
            onPress={() => router.replace(item.path as never)}
            className="flex-1 flex-col items-center gap-1 rounded-full px-1 py-1.5"
            style={({ pressed }) => ({
              backgroundColor: focused ? TAB_ACTIVE_BG : 'transparent',
              transform: pressed ? [{ scale: 0.9 }] : undefined,
            })}
          >
            <View>
              <Icon
                name={item.icon}
                size={22}
                color={focused ? '#FFFFFF' : TAB_INACTIVE_ICON}
              />
              {count > 0 ? (
                <View
                  className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: item.badgeTone === 'danger' ? colors.error : colors.secondary,
                    borderWidth: 1,
                    borderColor: TAB_BAR_BG,
                  }}
                />
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              className="text-[10px]"
              style={{
                color: focused ? '#FFFFFF' : TAB_INACTIVE_ICON,
                fontWeight: focused ? '700' : '600',
              }}
            >
              {t(item.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
