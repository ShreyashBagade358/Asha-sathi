// Subpath imports, not the package root: the root index `require`s all ~18
// Inter weights (~6MB). These four are the only ones the type scale uses
// (400 regular / 500 medium / 600 semibold / 700 bold) = ~1.3MB.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initializeDatabase } from '@/db/database';
import { hydrateLocale } from '@/i18n';
import './../global.css';
import { startNetworkWatcher } from '@/sync/network';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or unavailable on web. Not fatal.
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      // The store must be ready before any screen reads from it. A failure here
      // must not become an unhandled rejection: the screens need to render so
      // the ASHA can see *something* is wrong and restart, rather than get a
      // blank screen with no clue why.
      await initializeDatabase();
      if (cancelled) return;
      // Restore the persisted EN/hi preference before the first screen renders
      // so no screen flashes the wrong language.
      await hydrateLocale();
      if (cancelled) return;
      stop = startNetworkWatcher();
    })().catch((error) => {
      console.error('[startup] database/locale init failed', error);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  // Hold the splash until Inter is ready, otherwise the first paint uses the
  // system font and the app visibly reflows. fontError still proceeds so a
  // font failure cannot permanently block the app.
  //
  // This must be an effect, not a View onLayout callback: the gate below stops
  // rendering that View the moment the fonts resolve, so the callback would
  // never fire again and the splash would stay up forever.
  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return <View />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.onPrimary,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {/* Login draws its own top bar via Screen, so the native header is
            hidden here to avoid two stacked bars. */}
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
