import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocalization } from '@/i18n/useLocalization';
import { TabBar } from '@/nav/TabBar';
import { PATIENT_BOTTOM_NAV } from '@/nav/config';
import { useColors } from '@/theme';

/**
 * The five tab destinations are exactly the items the web marks
 * `bottomNav: true` for the patient sidebar (home, health-profile, records,
 * vaccination, settings). Appointments, referrals and notifications sit behind
 * the top app bar's More sheet, so the bar stays at five like the web's.
 *
 * No badges: the patient shell has no local work queue to count, and the web's
 * hardcoded "3" on notifications was decorative.
 */
export default function PatientTabsLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLocalization();
  const c = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.background, paddingTop: insets.top },
      }}
      tabBar={(props) => <TabBar state={props.state} items={PATIENT_BOTTOM_NAV} />}
    >
      <Tabs.Screen name="home" options={{ title: t('nav.patientHome') }} />
      <Tabs.Screen name="health-profile" options={{ title: t('nav.patientProfile') }} />
      <Tabs.Screen name="records" options={{ title: t('nav.patientRecords') }} />
      <Tabs.Screen name="vaccination" options={{ title: t('nav.patientVaccination') }} />
      <Tabs.Screen name="settings" options={{ title: t('nav.patientSettings') }} />
    </Tabs>
  );
}
