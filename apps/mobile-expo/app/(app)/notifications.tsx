import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StatCard } from '@/components/ui/StatCard';
import {
  buildNotifications,
  getReadNotificationIds,
  listServerNotifications,
  setAllNotificationsRead,
  setNotificationRead,
  type AppNotification,
} from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';
import { subscribeSync } from '@/sync/network';
import { cx } from '@/cx';
import { colors } from '@/theme';

type Filter = 'all' | 'unread' | AppNotification['kind'];

const SEVERITY_CLS: Record<AppNotification['severity'], string> = {
  high: 'bg-error-container',
  medium: 'bg-surface-container-highest',
  low: 'bg-secondary-container',
};

const SEVERITY_TEXT: Record<AppNotification['severity'], string> = {
  high: 'text-on-error-container',
  medium: 'text-on-surface',
  low: 'text-on-secondary-container',
};

const KIND_ICON: Record<AppNotification['kind'], IconName> = {
  overdue: 'alert',
  due: 'calendar',
  referral: 'fileText',
  immunization: 'shield',
  patient_update: 'users',
};

/**
 * Where a tap should land, derived from what the row is about - the same
 * mapping the web applies to its notification types. A row with no derivable
 * route (a server "profile updated" notice) only marks itself read.
 */
function routeFor(row: AppNotification): string | null {
  if (row.kind === 'overdue' || row.kind === 'due') return '/tasks';
  if (row.kind === 'referral') return '/referrals';
  if (row.kind === 'immunization' && row.patient_id) return `/patient/${row.patient_id}/immunization`;
  return null;
}

/**
 * Notifications, from the More menu.
 *
 * There is no server notification feed to pull - the backend's sync registry
 * does not include `notifications` - so these are derived from the tables that
 * do sync. That is the better behaviour for this app anyway: an ASHA in a
 * village with no signal still sees the overdue visit.
 *
 * Read state lives beside the rows in `sync_metadata` (setNotificationRead),
 * which is exactly what the top-bar bell badge subtracts, so tapping a row
 * here drops the badge on the screen that owns it.
 */
export default function NotificationsScreen() {
  const { t } = useLocalization();
  const router = useRouter();
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const load = useCallback(async (quiet = false) => {
    // A background reload (sync landing) keeps the list on screen instead of
    // dropping back to the loading state underneath the user.
    if (!quiet) setStatus('loading');
    try {
      const [derived, server, read] = await Promise.all([
        buildNotifications(),
        listServerNotifications(),
        getReadNotificationIds(),
      ]);
      // Server notifications (patient profile updates) first, then derived
      // clinical alerts, deduplicated by id.
      const seen = new Set(server.map((n) => n.id));
      setRows([...server, ...derived.filter((n) => !seen.has(n.id))]);
      setReadIds(read);
      setStatus('ready');
    } catch {
      setRows([]);
      setReadIds(new Set());
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A sync landing while open can add or resolve alerts; reload quietly.
  useEffect(() => subscribeSync((result) => {
    if (result) void load(true);
  }), [load]);

  const unread = useMemo(() => rows.filter((r) => !readIds.has(r.id)), [rows, readIds]);

  const counts = useMemo(() => {
    const by = (kind: AppNotification['kind']) => rows.filter((r) => r.kind === kind).length;
    return {
      all: rows.length,
      unread: unread.length,
      overdue: by('overdue'),
      due: by('due'),
      referral: by('referral'),
      immunization: by('immunization'),
    };
  }, [rows, unread]);

  const visible =
    filter === 'all'
      ? rows
      : filter === 'unread'
        ? rows.filter((r) => !readIds.has(r.id))
        : rows.filter((r) => r.kind === filter);

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: t('modules.notifAll'), count: counts.all },
    { key: 'unread', label: t('modules.notifUnread'), count: counts.unread },
    { key: 'overdue', label: t('modules.notifOverdueTask'), count: counts.overdue },
    { key: 'due', label: t('modules.notifDueToday'), count: counts.due },
    { key: 'referral', label: t('modules.notifReferralFollowUp'), count: counts.referral },
    { key: 'immunization', label: t('modules.notifImmunizationDue'), count: counts.immunization },
  ];

  /** Marks the row read and opens the screen it points at. */
  const openRow = (row: AppNotification) => {
    if (!readIds.has(row.id)) {
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(row.id);
        return next;
      });
      // Best-effort: the read set is local SQLite, and the next load resyncs
      // it if this write somehow fails.
      void setNotificationRead(row.id, true).catch(() => {});
    }
    const route = routeFor(row);
    if (route) router.push(route);
  };

  const markAllRead = async () => {
    const ids = unread.map((r) => r.id);
    if (ids.length === 0) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    try {
      await setAllNotificationsRead(ids);
    } catch {
      // Re-read the stored set so the screen never claims more than is saved.
      await load(true);
    }
  };

  return (
    <Screen
      header="page"
      title={t('asha.notifTitle')}
      back
      withTabBar={false}
      actions={<LanguageToggle onSurface />}
    >
      {status === 'ready' && rows.length > 0 ? (
        <>
          <View className="-mx-1 mb-4 flex-row flex-wrap gap-2">
            <View className="w-[46%] grow px-1">
              <StatCard label={t('modules.notifHigh')} value={counts.overdue} icon="alert" tone="error" />
            </View>
            <View className="w-[46%] grow px-1">
              <StatCard label={t('modules.notifMedium')} value={counts.due + counts.referral} icon="calendar" />
            </View>
            <View className="w-[46%] grow px-1">
              <StatCard label={t('modules.notifLow')} value={counts.immunization} icon="shield" tone="secondary" />
            </View>
          </View>

          {counts.unread > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('modules.notifMarkAll')}
              onPress={() => void markAllRead()}
              className="mb-4 flex-row items-center gap-2 self-start rounded-full border border-outline px-5 py-2.5 active:opacity-70"
            >
              <Icon name="checkCircle" size={18} color={colors.primary} />
              <Text className="font-label-md text-label-md font-semibold text-primary">{t('modules.notifMarkAll')}</Text>
            </Pressable>
          ) : null}

          <View className="mb-4 flex-row flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Pill key={f.key} label={f.label} count={f.count} active={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </View>
        </>
      ) : null}

      {status === 'failed' ? (
        <EmptyState
          icon="alertCircle"
          title={t('common.errorTitle')}
          description={t('common.errorMsg')}
          action={<Button label={t('common.retry')} onPress={() => void load()} />}
        />
      ) : status === 'loading' ? (
        <EmptyState icon="inbox" title={t('common.loading')} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="checkCircle"
          title={filter === 'all' ? t('modules.notifEmptyTitle') : t('asha.notifEmpty')}
          description={filter === 'all' ? t('modules.notifEmptyHint') : undefined}
        />
      ) : (
        <View className="gap-3">
          <Text className="mb-1 text-caption text-caption text-on-surface-variant">{t('modules.notifOfflineNote')}</Text>
          {visible.map((row) => (
            <NotificationCard key={row.id} row={row} read={readIds.has(row.id)} onPress={() => openRow(row)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function NotificationCard({
  row,
  read,
  onPress,
}: {
  row: AppNotification;
  read: boolean;
  onPress: () => void;
}) {
  const { t } = useLocalization();

  const headline =
    row.kind === 'overdue'
      ? t('modules.notifOverdueTask')
      : row.kind === 'due'
        ? t('modules.notifDueToday')
        : row.kind === 'referral'
          ? t('modules.notifReferralFollowUp')
          : t('modules.notifImmunizationDue');

  // Matches the web row: unread sits on a tinted surface with an accent dot,
  // read rows are dimmed so the outstanding work is what the eye lands on.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.title || headline}
      onPress={onPress}
      className={cx(
        'rounded-2xl border border-outline-variant/40 p-4 shadow-card active:opacity-90',
        read ? 'bg-surface-container-lowest opacity-60' : 'bg-surface-container-low/40',
      )}
    >
      <View className="flex-row items-start gap-3">
        <View className={cx('h-10 w-10 shrink-0 items-center justify-center rounded-full', SEVERITY_CLS[row.severity])}>
          <Icon name={KIND_ICON[row.kind]} size={20} color={row.severity === 'high' ? colors.onErrorContainer : colors.onSurface} />
        </View>

        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Text className="min-w-0 flex-1 text-body-md text-body-md font-semibold text-on-surface" numberOfLines={1}>
              {headline}
            </Text>
            {!read ? <View className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
          </View>
          {row.title ? (
            <Text className="text-body-sm text-body-sm text-on-surface" numberOfLines={2}>
              {row.title}
            </Text>
          ) : null}
          {row.body ? (
            <Text className="text-body-sm text-body-sm text-on-surface-variant" numberOfLines={1}>
              {row.body}
            </Text>
          ) : null}
          <View className="mt-1 flex-row flex-wrap items-center gap-2">
            {row.date ? (
              <Text className="text-caption text-caption text-on-surface-variant" numberOfLines={1}>
                {row.date}
              </Text>
            ) : null}
            <View className={cx('rounded-full px-2 py-0.5', SEVERITY_CLS[row.severity])}>
              <Text className={cx('text-[11px] font-semibold', SEVERITY_TEXT[row.severity])}>
                {row.severity === 'high'
                  ? t('modules.notifHigh')
                  : row.severity === 'medium'
                    ? t('modules.notifMedium')
                    : t('modules.notifLow')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
