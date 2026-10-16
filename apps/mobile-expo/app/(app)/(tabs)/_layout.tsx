import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBar } from '@/nav/TabBar';
import { useTabBadges } from '@/nav/useTabBadges';
import { useColors } from '@/theme';

/**
 * The five tab destinations are exactly the items the web marks
 * `bottomNav: true` in AdminLayout (home, tasks, patients, households, sync).
 * Everything else the ASHA sidebar exposes is reachable from the top app bar's
 * More sheet, so the bar stays at five items like the web's.
 *
 * `sceneStyle.paddingTop` pushes every scene below the status bar / notch —
 * the screens draw their own headers and would otherwise start at y=0 under
 * the system UI.
 */
export default function TabsLayout() {
  const badges = useTabBadges();
  const insets = useSafeAreaInsets();
  const c = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.background, paddingTop: insets.top },
      }}
      tabBar={(props) => <TabBar state={props.state} badges={badges} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="patients" options={{ title: 'Patients' }} />
      <Tabs.Screen name="households" options={{ title: 'Households' }} />
      <Tabs.Screen name="sync" options={{ title: 'Sync' }} />
    </Tabs>
  );
}
