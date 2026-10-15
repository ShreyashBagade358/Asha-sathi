import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { getQueueCounts } from '@/db/database';
import { Icon } from '@/components/ui/Icon';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';
import { isCurrentlyOnline, subscribeOnline, subscribeSync } from '@/sync/network';

export type OfflineBannerProps = {
  /** Tapping the banner opens the connection help screen. */
  onPress?: () => void;
};

/**
 * "Offline Mode: N pending syncs" strip, from the web's AshaWorkerHome
 * offline pill (asha.offlineMode) but with a real count instead of the mock's
 * hard-coded 5.
 *
 * It renders only while the device is actually offline - an online device with
 * a deep outbox already has the Sync Center tab badge for that - and the count
 * is `pending + failed`, i.e. the same number the danger tab badge and the
 * Sync Center's "Pending" total use.
 *
 * Pattern for other screens: render it directly under the top bar, above the
 * page content.
 *
 *   <OfflineBanner onPress={() => router.push('/connection-error')} />
 */
export function OfflineBanner({ onPress }: OfflineBannerProps) {
  const { t } = useLocalization();
  const [online, setOnline] = useState(() => isCurrentlyOnline());
  const [pending, setPending] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const counts = await getQueueCounts();
      setPending((counts.pending ?? 0) + (counts.failed ?? 0));
    } catch {
      // The banner is informational; never fail a screen over the count.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const offSync = subscribeSync((result, working) => {
      if (!working) void refresh();
    });
    const offOnline = subscribeOnline(setOnline);
    return () => {
      offSync();
      offOnline();
    };
  }, [refresh]);

  if (online) return null;

  const body = (
    <View className="w-full flex-row items-center gap-2 rounded-lg bg-surface-container px-4 py-2.5">
      <Icon name="wifiOff" size={16} color={colors.onSurfaceVariant} />
      <Text className="flex-1 font-label-md text-label-md text-on-surface">
        {t('asha.offlineBanner', { count: pending })}
      </Text>
      {onPress ? <Icon name="chevronRight" size={16} color={colors.onSurfaceVariant} /> : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('asha.connectionHelp')} onPress={onPress}>
      {body}
    </Pressable>
  );
}
