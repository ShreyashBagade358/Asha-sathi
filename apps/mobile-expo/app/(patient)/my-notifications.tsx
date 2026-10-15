import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card, Pill } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/LoadingState';
import { useToast } from '@/components/ui/Toast';
import { listNotifications, markNotificationRead, type PatientNotification } from '@/patient/api';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';

type PageNotifType = PatientNotification['type'] | 'alert' | 'sync' | 'incentive';

const TYPE_META: Record<PageNotifType, { label: string; bg: string; icon: IconName }> = {
  appointment: { label: 'patient.notifAppointments', bg: 'bg-primary-container', icon: 'calendar' },
  referral: { label: 'patient.notifReferrals', bg: 'bg-error-container', icon: 'activity' },
  health: { label: 'patient.notifHealth', bg: 'bg-secondary-container', icon: 'heart' },
  system: { label: 'patient.notifSystem', bg: 'bg-tertiary-container', icon: 'settings' },
  alert: { label: 'patient.notifAlerts', bg: 'bg-error-container', icon: 'alert' },
  sync: { label: 'patient.notifSync', bg: 'bg-primary-container', icon: 'refresh' },
  incentive: { label: 'patient.notifIncentive', bg: 'bg-tertiary-container', icon: 'barChart' },
};

/** Unknown server types render like the web does: as a system notice. */
const SYSTEM_META = { label: 'patient.notifSystem', bg: 'bg-tertiary-container', icon: 'settings' as IconName };

function formatTime(iso: string): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? iso
    : parsed.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Notifications, ported from the web's PatientNotificationsPage: the same
 * filter pills (all / unread / appointment / referral) and list, fed by the
 * server's `GET /notifications` feed. Tapping an unread row marks it read
 * (like the web), and "Mark all read" walks the unread ids.
 */
export default function PatientMyNotificationsScreen() {
  const { t } = useLocalization();
  const { toast } = useToast();
  const [rows, setRows] = useState<PatientNotification[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [filter, setFilter] = useState<'all' | 'unread' | 'appointment' | 'referral'>('all');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setRows(await listNotifications());
      setStatus('ready');
    } catch {
      setRows([]);
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = rows.filter((row) => !row.read);
  const visible = rows.filter((row) =>
    filter === 'all' ? true : filter === 'unread' ? !row.read : row.type === filter,
  );

  const tabs: { key: 'all' | 'unread' | 'appointment' | 'referral'; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: rows.length },
    { key: 'unread', label: t('patient.notifUnread'), count: unread.length },
    { key: 'appointment', label: t('patient.notifAppointments'), count: rows.filter((r) => r.type === 'appointment').length },
    { key: 'referral', label: t('patient.notifReferrals'), count: rows.filter((r) => r.type === 'referral').length },
  ];

  const markRead = async (row: PatientNotification) => {
    if (row.read || busy) return;
    setBusy(true);
    try {
      await markNotificationRead(row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, read: true } : r)));
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.errorMsg'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    if (busy || unread.length === 0) return;
    setBusy(true);
    try {
      // All-settled rather than all: one refused PUT must not roll the UI
      // back, so the rows that did land stay marked read and only the
      // failures are reported.
      const results = await Promise.allSettled(
        unread.map((row) => markNotificationRead(row.id)),
      );
      const okIds = new Set(
        unread.filter((_, index) => results[index]?.status === 'fulfilled').map((row) => row.id),
      );
      setRows((prev) => prev.map((r) => (okIds.has(r.id) ? { ...r, read: true } : r)));
      if (okIds.size < unread.length) {
        toast(t('common.errorMsg'), 'error');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.errorMsg'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={t('patient.notifTitle')}
      subtitle={t('patient.notifSubtitle')}
      back
      withTabBar={false}
      actions={
        unread.length > 0 ? (
          <Button
            label={t('patient.notifMarkAll')}
            icon="checkCircle"
            variant="secondary"
            shape="pill"
            loading={busy}
            onPress={() => void markAllRead()}
            testID="mark-all-read"
          />
        ) : undefined
      }
    >
      {status === 'failed' ? (
        <ErrorState message={t('common.errorMsg')} onRetry={() => void load()} />
      ) : status === 'loading' ? (
        <LoadingState />
      ) : (
        <>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {tabs.map((tab) => (
              <Pill
                key={tab.key}
                label={tab.label}
                count={tab.count}
                active={filter === tab.key}
                onPress={() => setFilter(tab.key)}
              />
            ))}
          </View>

          {visible.length === 0 ? (
            <EmptyState icon="bell" title={t('patient.notifEmpty')} />
          ) : (
            <Card>
              {visible.map((row, index) => {
                const meta = TYPE_META[row.type as PageNotifType] ?? SYSTEM_META;
                return (
                  <Pressable
                    key={row.id}
                    accessibilityRole="button"
                    onPress={() => void markRead(row)}
                    className={cx(
                      'flex-row items-start gap-3 px-4 py-4',
                      index < visible.length - 1 && 'border-b border-outline-variant/40',
                      row.read ? 'opacity-60' : 'bg-surface-container-low/40',
                    )}
                  >
                    <View className={cx('mt-0.5 h-10 w-10 shrink-0 items-center justify-center rounded-full', meta.bg)}>
                      <Icon name={meta.icon} size={20} />
                    </View>
                    <View className="min-w-0 flex-1 gap-0.5">
                      <View className="flex-row items-center gap-2">
                        <Text className="flex-1 text-label-md text-label-md font-semibold text-on-surface" numberOfLines={1}>
                          {row.title}
                        </Text>
                        {!row.read ? <View className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                      </View>
                      <Text className="text-body-md text-body-md text-on-surface-variant">{row.message}</Text>
                      <View className="mt-1 flex-row items-center gap-1">
                        <Icon name="calendar" size={13} />
                        <Text className="text-caption text-caption text-outline">{formatTime(row.createdAt)}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
