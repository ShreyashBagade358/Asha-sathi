import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initializeDatabase } from '../src/db/database';
import { startNetworkWatcher } from '../src/sync/network';

export default function RootLayout() {
  useEffect(() => {
    let stop: (() => void) | undefined;
    void (async () => {
      // The store must be ready before any screen reads from it.
      await initializeDatabase();
      stop = startNetworkWatcher();
    })();
    return () => stop?.();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0F766E' },
          headerTintColor: '#FFFFFF',
          contentStyle: { backgroundColor: '#F8FAFC' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Sign in' }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
