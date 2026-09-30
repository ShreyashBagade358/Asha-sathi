import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { restoreSession } from '@/auth/session';
import { tokenStore } from '@/auth/tokenStore';
import { Icon } from '@/components/ui/Icon';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

/**
 * Cold-start gate. A stored token is only trusted once the cached user has been
 * re-hydrated from AsyncStorage by restoreSession(); if that fails the user is
 * sent back to /login rather than into the tab shell with a dead session.
 */
export default function Index() {
  const { t } = useLocalization();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void (async () => {
      const token = await tokenStore.getAccessToken();
      if (token) {
        const user = await restoreSession();
        setSignedIn(Boolean(user));
      }
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Icon name="heart" size={30} color={colors.onPrimary} />
        </View>
        <View className="items-center gap-1">
          <Text className="text-headline-md text-headline-md font-bold text-on-surface">{t('common.appName')}</Text>
          <Text className="text-caption text-caption text-on-surface-variant">{t('common.loading')}</Text>
        </View>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={signedIn ? '/(app)' : '/login'} />;
}
