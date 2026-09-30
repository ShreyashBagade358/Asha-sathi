import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useLocalization } from '@/i18n/useLocalization';
import { syncNow } from '@/sync/network';
import { colors } from '@/theme';

/**
 * Port of ConnectionErrorAshaSathi.tsx.
 *
 * The web fakes the retry with a 1.2s setTimeout and then navigates home
 * regardless. Here the retry is a real sync attempt: it only navigates when the
 * sync actually reports ok, and surfaces the real failure reason otherwise, which
 * is the behaviour an offline-first app needs.
 */
export default function ConnectionErrorScreen() {
  const { t } = useLocalization();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const retry = async () => {
    setChecking(true);
    setFailure(null);
    const result = await syncNow();
    setChecking(false);
    if (result.ok) {
      router.replace('/');
    } else {
      setFailure(result.error ?? t('asha.connectionHint'));
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-surface px-4 py-12">
      <View className="w-full max-w-md items-center">
        <View className="mb-6 h-32 w-32 items-center justify-center rounded-full bg-error-container">
          <Icon name="box" size={64} color={colors.onErrorContainer} />
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

        <View className="mt-8 flex-row items-center gap-1 rounded-full border border-outline-variant bg-surface-container-high px-4 py-1">
          <View className="h-2 w-2 rounded-full bg-outline" />
          <Text className="font-caption text-caption text-on-surface-variant">{t('asha.currentlyOffline')}</Text>
        </View>
      </View>
    </View>
  );
}
