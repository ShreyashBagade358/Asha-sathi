import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { tokenStore } from '@/auth/tokenStore';
import { colors } from '@/theme';

/**
 * Auth gate for the patient dashboard, the mirror of app/(app)/_layout.tsx.
 *
 * A signed-out visitor is sent to /login; an ASHA / PHC session that somehow
 * reaches a patient route is pushed back to the worker shell, so each role can
 * only ever sit inside its own group.
 */
export default function PatientLayout() {
  const [ready, setReady] = useState(false);
  const [destination, setDestination] = useState<'patient' | 'worker' | 'login' | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await tokenStore.getAccessToken();
        const user = await tokenStore.getUser();
        if (cancelled) return;
        setDestination(!token ? 'login' : user?.role === 'patient' ? 'patient' : 'worker');
      } catch {
        // A secure-store failure must not strand the gate on its spinner:
        // treat the session as absent and let /login sort it out.
        if (cancelled) return;
        setDestination('login');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (destination === 'login') {
    return <Redirect href="/login" />;
  }

  if (destination === 'worker') {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="appointments" />
      <Stack.Screen name="family" />
      <Stack.Screen name="my-referrals" />
      <Stack.Screen name="my-notifications" />
    </Stack>
  );
}
