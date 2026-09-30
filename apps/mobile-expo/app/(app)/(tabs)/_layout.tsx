import { Tabs } from 'expo-router';

import { TabBar } from '@/nav/TabBar';
import { useTabBadges } from '@/nav/useTabBadges';

/**
 * The five tab destinations are exactly the items the web marks
 * `bottomNav: true` in AdminLayout (home, tasks, patients, households, sync).
 * Everything else the ASHA sidebar exposes is reachable from the top app bar's
 * More sheet, so the bar stays at five items like the web's.
 */
export default function TabsLayout() {
  const badges = useTabBadges();

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#F9F9FF' } }}
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
