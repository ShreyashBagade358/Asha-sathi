import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Card, PageHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { clearConflict, getConflicts, getQueueCounts, getQueueItems } from '@/db/database';
import { useLocalization } from '@/i18n/useLocalization';
import { LanguageToggle } from '@/components/LanguageToggle';
import { MoreButton } from '@/nav/MoreSheet';
import { getServerStatus, getSyncSnapshot } from '@/sync/engine';
import { subscribeOnline, subscribeSync, syncNow } from '@/sync/network';
import type { QueueItem, SyncState, SyncStatusResponse } from '@/types';
import { cx } from '@/cx';
import { shadow } from '@/theme';

/**
 * Port of OfflineSyncCenterAshaSathi.tsx.
 *
 * The web page drives its queue from SYNC_QUEUE mock rows and fakes a sync with
 * setTimeout(1500). This version keeps the web's layout and tabs but backs them
 * with the real outbox, the real watermark, the real conflict table, and the
 * real server status endpoint, so the counters here are the same numbers the
 * engine acts on.
 *
 * The legacy screen's two genuinely useful surfaces (server counters and
 * conflict resolution) are kept as well - the web page has neither.
 */

type Tab = 'pending' | 'synced' | 'failed';

const STATE_STYLE: Record<SyncState, { chip: string; icon: IconName; labelKey: string; failed?: boolean }> = {
  pending: { chip: 'bg-surface-container', icon: 'box', labelKey: 'asha.storedLocally' },
  syncing: { chip: 'bg-tertiary-fixed', icon: 'refresh', labelKey: 'asha.syncing' },
  failed: { chip: 'bg-error', icon: 'alert', labelKey: 'asha.failed', failed: true },
  conflict: { chip: 'bg-error', icon: 'alert', labelKey: 'asha.failed', failed: true },
  synced: { chip: 'bg-secondary-container', icon: 'checkCircle', labelKey: 'asha.synced' },
};

export default function SyncScreen() {
  const { t, locale } = useLocalization();

  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState<Record<SyncState, number>>({ pending: 0, syncing: 0, synced: 0, failed: 0, conflict: 0 });
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [server, setServer] = useState<SyncStatusResponse | null>(null);
  const [conflicts, setConflicts] = useState<Array<{ clientRequestId: string; entity: string; recordId: string; reason: string | null; createdAt: string }>>([]);

  const load = useCallback(async () => {
    const [snapshot, queue, conflictRows, status] = await Promise.all([
      getSyncSnapshot(),
      getQueueItems(),
      getConflicts(),
      getServerStatus(),
    ]);
    setItems(queue);
    setCounts(await getQueueCounts());
    setLastSyncAt(snapshot.lastSyncAt);
    setServer(status);
    setConflicts(
      conflictRows.map((row) => ({
        clientRequestId: row.clientRequestId,
        entity: row.entity,
        recordId: row.recordId,
        reason: row.reason,
        createdAt: row.createdAt,
      })),
    );
  }, []);

  useEffect(() => {
    void load();
    const offOnline = subscribeOnline(setOnline);
    const offSync = subscribeSync((_result, working) => {
      setBusy(working);
      if (!working) void load();
    });
    return () => {
      offOnline();
      offSync();
    };
  }, [load]);

  const pendingCount = (counts.pending ?? 0) + (counts.syncing ?? 0) + (counts.conflict ?? 0);
  const failedCount = (counts.failed ?? 0) + (counts.conflict ?? 0);
  const syncedCount = counts.synced ?? 0;

  const visible = items.filter((item) => {
    if (tab === 'pending') return item.state === 'pending' || item.state === 'syncing';
    if (tab === 'failed') return item.state === 'failed' || item.state === 'conflict';
    return item.state === 'synced';
  });

  const run = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await syncNow();
    void load();
  };

  const tabs: Array<{ key: Tab; label: string; count: number; tone?: string }> = [
    { key: 'pending', label: t('asha.pending'), count: pendingCount },
    { key: 'synced', label: t('asha.synced'), count: syncedCount },
    { key: 'failed', label: t('asha.failed'), count: failedCount, tone: failedCount ? 'text-error' : undefined },
  ];

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 px-4 pb-28" showsVerticalScrollIndicator={false}>
        <PageHeader title={t('asha.syncCenterTitle')} subtitle={t('asha.syncCenterSubtitle')}
          actions={
            <>
              <LanguageToggle onSurface />
              <MoreButton />
            </>
          }
        />

        <View className="flex-row items-center gap-2 self-start rounded-lg border border-outline bg-outline-variant/40 px-4 py-2">
          <View className={cx('h-2 w-2 rounded-full', online ? 'bg-secondary' : 'bg-error')} />
          <Text className="font-label-md text-label-md text-on-surface-variant">
            {online ? t('nav.online') : t('asha.currentlyOffline')}
          </Text>
        </View>

        <View className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low p-5">
          <View className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-primary-fixed opacity-20" />
          <Icon name="box" size={40} />
          <Text className="font-display-lg text-display-lg font-bold text-on-surface">{pendingCount}</Text>
          <Text className="font-body-lg text-body-lg font-medium text-on-surface-variant">{t('asha.pendingRecords')}</Text>
          <Text className="mt-1 font-caption text-caption text-outline">
            {t('asha.lastSyncedAt', {
              time: lastSyncAt
                ? new Date(lastSyncAt).toLocaleString(locale === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                : '—',
            })}
          </Text>
          <Button
            label={t('asha.syncNow')}
            icon="refresh"
            shape="pill"
            full
            loading={busy}
            disabled={!online || pendingCount === 0}
            onPress={() => void run()}
            className="mt-4"
            testID="sync-now-button"
          />
        </View>

        <View className="flex-row border-b border-outline-variant">
          {tabs.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.key }}
              onPress={() => setTab(item.key)}
              className={cx(
                'flex-1 border-b-2 pb-2 text-center font-label-md text-label-md font-semibold',
                tab === item.key ? cx('border-primary', item.tone ?? 'text-primary') : 'border-transparent text-on-surface-variant',
              )}
            >
              <Text className={cx('font-label-md text-label-md font-semibold', tab === item.key ? item.tone ?? 'text-primary' : 'text-on-surface-variant')}>
                {item.label} ({item.count})
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="gap-3">
          {visible.length === 0 ? (
            <EmptyState icon="checkCircle" title={t('asha.nothingToShow')} />
          ) : (
            visible.map((item) => {
              const style = STATE_STYLE[item.state];
              return (
                <View
                  key={item.clientRequestId}
                  className={cx(
                    'relative gap-2 overflow-hidden rounded-lg border p-4',
                    item.state === 'failed' || item.state === 'conflict'
                      ? 'border-error/30 bg-error-container'
                      : 'border-outline-variant bg-surface-container-lowest',
                  )}
                  style={shadow.card}
                >
                  {item.state === 'syncing' ? <View className="absolute left-0 top-0 h-1 w-1/3 bg-tertiary" /> : null}
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-4">
                      <Text className={cx('font-body-lg text-body-lg font-semibold', style.failed ? 'text-on-error-container' : 'text-on-surface')}>
                        {item.entity}
                      </Text>
                      <Text className={cx('mt-1 font-body-md text-body-md', style.failed ? 'text-on-error-container' : 'text-on-surface-variant')}>
                        {item.lastError ?? t('asha.formLabel', { form: item.operation })}
                      </Text>
                    </View>
                    {item.state === 'syncing' ? <Icon name="refresh" size={20} /> : null}
                    {style.failed ? <Icon name="alert" size={20} /> : null}
                  </View>
                  <View className="flex-row items-center gap-1">
                    <View className={cx('flex-row items-center gap-1 rounded-full px-3 py-1', style.chip)}>
                      <Icon name={style.icon} size={14} />
                      <Text className="font-caption text-caption font-bold text-on-surface-variant">{t(style.labelKey)}</Text>
                    </View>
                    {item.state === 'failed' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('asha.retry')}
                        onPress={() => {
                          void (async () => {
                            await syncNow();
                            void load();
                          })();
                        }}
                      >
                        <Text className="font-label-md text-label-md text-error underline">{t('asha.retry')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {conflicts.length > 0 ? (
          <View className="gap-3">
            <SectionLabel title={`${t('errors.useServerVersion')} · ${conflicts.length}`} />
            {conflicts.map((conflict) => (
              <Card key={conflict.clientRequestId}>
                <View className="gap-2 p-4">
                  <Text className="font-label-md text-label-md font-semibold text-on-surface">
                    {conflict.entity} · {conflict.recordId.slice(0, 8)}
                  </Text>
                  <Text className="font-caption text-caption text-error">{conflict.reason ?? '—'}</Text>
                  <Text className="font-caption text-caption text-on-surface-variant">
                    {new Date(conflict.createdAt).toLocaleString()}
                  </Text>
                  <Button
                    label={t('errors.useServerVersion')}
                    variant="ghost"
                    onPress={() => {
                      void (async () => {
                        // The server row was already pulled, so dropping the local
                        // edit lets the next pull re-apply the server values.
                        await clearConflict(conflict.clientRequestId);
                        void load();
                      })();
                    }}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {server ? (
          <View className="gap-3">
            <SectionLabel title={t('errors.serverStatus')} />
            <Card>
              <View className="gap-2 p-4">
                <Row label={t('asha.pending')} value={String(server.pending_push)} />
                <Row label={t('errors.pullQueue')} value={String(server.pending_pull)} />
                <Row label={t('asha.failed')} value={String(server.conflicts)} />
              </View>
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <Text className="font-headline-md text-headline-md font-semibold text-on-surface">{title}</Text>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-body-md text-body-md text-on-surface-variant">{label}</Text>
      <Text className="font-body-md text-body-md font-medium text-on-surface">{value}</Text>
    </View>
  );
}
