import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { syncApi } from '@/auth/api';
import { Button } from '@/components/ui/Button';
import { cx } from '@/cx';
import { useLocalization } from '@/i18n/useLocalization';
import { useShellChrome } from '@/nav/useShellChrome';
import { isCurrentlyOnline, subscribeOnline, syncNow } from '@/sync/network';
import { colors } from '@/theme';

/**
 * Port of ConnectionErrorAshaSathi.tsx.
 *
 * The web fakes the retry with a 1.2s setTimeout and then navigates home
 * regardless. Here the retry is a real probe: connectivity from
 * src/sync/network, then GET /sync/status as the API ping, then an actual
 * sync - it only navigates when the sync reports ok, and surfaces the real
 * failure reason otherwise, which is the behaviour an offline-first app needs.
 *
 * The medallion keeps the web's 128px `bg-error-container` disc and its
 * `animate-ping` ring, reproduced with RN's Animated (Reanimated is not
 * required for a decorative loop), and swaps the box glyph for the mock's
 * `cloud_off`.
 */
export default function ConnectionErrorScreen() {
  const { t } = useLocalization();
  const router = useRouter();
  const chrome = useShellChrome({ showStatus: false });
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Live connectivity: the bottom chip must agree with the Online/Offline pill
  // every other screen shows, instead of claiming "Currently Offline" while
  // the device has already come back online.
  const [online, setOnline] = useState(() => isCurrentlyOnline());

  useEffect(() => subscribeOnline(setOnline), []);

  const ping = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ping, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(ping, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ping]);

  const ringStyle = {
    opacity: ping.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
    transform: [{ scale: ping.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
  };

  const retry = async () => {
    setChecking(true);
    setFailure(null);

    if (!isCurrentlyOnline()) {
      setChecking(false);
      setFailure(t('asha.currentlyOffline'));
      return;
    }

    try {
      await syncApi.status();
    } catch (error) {
      setChecking(false);
      setFailure(error instanceof Error ? error.message : t('asha.connectionHint'));
      return;
    }

    const result = await syncNow();
    setChecking(false);
    if (result.ok) {
      router.replace('/');
    } else {
      setFailure(result.error ?? t('asha.connectionHint'));
    }
  };

  return (
    <Screen
      title={t('asha.connectionError')}
      back
      withTabBar={false}
      scroll={false}
      showStatus={chrome.showStatus}
      badgeCount={chrome.badgeCount}
      onBadgePress={chrome.onBadgePress}
      className="items-center justify-center px-4 py-8"
    >
      <View className="w-full max-w-md items-center">
        <View className="relative mb-6 h-32 w-32 items-center justify-center rounded-full bg-error-container">
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', top: -4, right: -4, bottom: -4, left: -4, borderRadius: 999, borderWidth: 4, borderColor: colors.errorContainer }, ringStyle]}
          />
          <Feather name="cloud-off" size={64} color={colors.onErrorContainer} />
        </View>

        <Text className="mb-2 text-center font-headline-lg text-headline-lg text-on-surface">
          {t('asha.connectionError')}
        </Text>
        <Text className="mb-8 px-4 text-center font-body-lg text-body-lg text-on-surface-variant">
          {failure ?? t('asha.connectionHint')}
        </Text>

        <View className="w-full gap-3">
          <Button
            label={checking ? t('asha.checking') : t('asha.retryConnection')}
            icon="refresh"
            shape="pill"
            full
            loading={checking}
            onPress={() => void retry()}
          />
          <Button
            label={t('asha.openSyncCenter')}
            icon="refresh"
            variant="ghost"
            shape="pill"
            full
            onPress={() => router.replace('/sync')}
          />
        </View>

        <View
          className={cx(
            'mt-8 flex-row items-center gap-1 rounded-full border px-4 py-1',
            online ? 'border-secondary/40 bg-secondary-container/60' : 'border-outline-variant bg-surface-container-high',
          )}
        >
          <View className={cx('h-2 w-2 rounded-full', online ? 'bg-secondary' : 'bg-outline')} />
          <Text
            className={cx(
              'font-caption text-caption',
              online ? 'text-on-secondary-container' : 'text-on-surface-variant',
            )}
          >
            {online ? t('nav.online') : t('asha.currentlyOffline')}
          </Text>
        </View>
      </View>
    </Screen>
  );
}
