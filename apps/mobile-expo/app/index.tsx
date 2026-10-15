import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, View } from 'react-native';

import { restoreSession } from '@/auth/session';
import { tokenStore } from '@/auth/tokenStore';
import { initializeDatabase } from '@/db/database';
import { hydrateLocale } from '@/i18n';
import { colors } from '@/theme';
import type { UserSummary } from '@/types';

const SPLASH_ART = require('../assets/splash-art.jpg');

/**
 * How long the ASHA Worker artwork stays up on a cold start, even when the
 * init below finishes sooner — it is the app's opening beat, not just a
 * loading placeholder.
 */
const SPLASH_MIN_MS = 6000;

/**
 * Whether the opening artwork has already played this launch. The hold above
 * is a cold-start beat: a later return to this route (a bounce out of the
 * patient shell, "back to dashboard") must hand off straight away instead of
 * making the ASHA watch six seconds of splash again.
 */
let splashPlayed = false;

/**
 * Cold-start gate. The full-bleed artwork (matching the native splash) holds
 * for SPLASH_MIN_MS while the database schema, saved language and session are
 * restored — all three are idempotent, so running them here is safe even
 * though the root layout kicks the same work off in parallel.
 *
 * A stored token is only trusted once the cached user has been re-hydrated by
 * restoreSession(); if that fails the user is sent back to /login rather than
 * into the tab shell with a dead session.
 */
export default function Index() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    const holdMs = splashPlayed ? 0 : SPLASH_MIN_MS;
    splashPlayed = true;
    void (async () => {
      const startedAt = Date.now();
      // Each leg fails on its own: a store that will not open must not discard
      // a session that restored fine, or the redirect below would sign a
      // signed-in ASHA out over an unrelated startup error.
      const [, session] = await Promise.all([
        (async () => {
          try {
            await initializeDatabase();
            await hydrateLocale();
          } catch (error) {
            console.warn('[splash] database/locale init failed', error);
          }
        })(),
        (async () => {
          try {
            const token = await tokenStore.getAccessToken();
            if (!token) return null;
            return await restoreSession();
          } catch (error) {
            console.warn('[splash] session restore failed', error);
            return null;
          }
        })(),
      ]);
      if (!cancelled) setUser(session);
      // Hold the artwork for the full minimum window, then hand off.
      const remaining = holdMs - (Date.now() - startedAt);
      if (cancelled) return;
      if (remaining > 0) {
        await new Promise<void>((resolve) => {
          holdTimer = setTimeout(resolve, remaining);
        });
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, []);

  if (!ready) {
    return (
      <ImageBackground source={SPLASH_ART} resizeMode="cover" className="flex-1 bg-background">
        <View className="flex-1 items-center justify-end pb-16">
          <ActivityIndicator color="#b5322c" />
        </View>
      </ImageBackground>
    );
  }

  // Each role owns a different shell: patients land on their dashboard, the
  // ASHA / PHC session lands on the worker tabs.
  return <Redirect href={user ? (user.role === 'patient' ? '/home' : '/(app)') : '/login'} />;
}
