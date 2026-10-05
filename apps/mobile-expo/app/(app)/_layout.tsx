import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { tokenStore } from '@/auth/tokenStore';
import { colors } from '@/theme';

/**
 * Auth gate for the signed-in area.
 *
 * This is the mobile equivalent of the web's ProtectedRoute in App.tsx: while
 * the stored session is still being read, render a spinner rather than either
 * the app or the login screen, so a cold start never flashes login at an
 * already-authenticated user.
 */
export default function AppLayout() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void (async () => {
      const token = await tokenStore.getAccessToken();
      setSignedIn(Boolean(token));
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!signedIn) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.onPrimary,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="patient/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="patient/[id]/immunization" options={{ headerShown: false }} />
        <Stack.Screen name="patient/[id]/profile" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="connection-error" options={{ headerShown: false }} />
        {/* More-menu modules. Real routes so the sheet never lands on an
            unmatched-route screen. */}
        <Stack.Screen name="pregnancy" options={{ headerShown: false }} />
        <Stack.Screen name="child-health" options={{ headerShown: false }} />
        <Stack.Screen name="referrals" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="health-survey" options={{ headerShown: false }} />
        <Stack.Screen name="health-checkup" options={{ headerShown: false }} />
        <Stack.Screen name="follow-ups" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
      </Stack>
  );
}
