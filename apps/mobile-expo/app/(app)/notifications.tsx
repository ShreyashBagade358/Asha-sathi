import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card, Pill } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StatCard } from '@/components/ui/StatCard';
import { buildNotifications, type AppNotification } from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';
import { colors } from '@/theme';

type Filter = 'all' | AppNotification['kind'];

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
};

/**
 * Notifications, from the More menu.
 *
 * There is no server notification feed to pull - the backend's sync registry
 * does not include `notifications` - so these are derived from the tables that
 * do sync. That is the better behaviour for this app anyway: an ASHA in a
 * village with no signal still sees the overdue visit.
 */
export default function NotificationsScreen() {
  const { t } = useLocalization();
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setRows(await buildNotifications());
      setStatus('ready');
    } catch {
      setRows([]);
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const by = (kind: AppNotification['kind']) => rows.filter((r) => r.kind === kind).length;
    return { all: rows.length, overdue: by('overdue'), due: by('due'), referral: by('referral'), immunization: by('immunization') };
  }, [rows]);

  const visible = filter === 'all' ? rows : rows.filter((r) => r.kind === filter);

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: t('modules.notifAll'), count: counts.all },
    { key: 'overdue', label: t('modules.notifOverdueTask'), count: counts.overdue },
    { key: 'due', label: t('modules.notifDueToday'), count: counts.due },
    { key: 'referral', label: t('modules.notifReferralFollowUp'), count: counts.referral },
    { key: 'immunization', label: t('modules.notifImmunizationDue'), count: counts.immunization },
  ];

  return (
    <Screen title={t('asha.notifTitle')} subtitle={t('asha.notifSubtitle')} back withTabBar={false}>
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
            <NotificationCard key={row.id} row={row} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function NotificationCard({ row }: { row: AppNotification }) {
  const { t } = useLocalization();

  const headline =
    row.kind === 'overdue'
      ? t('modules.notifOverdueTask')
      : row.kind === 'due'
        ? t('modules.notifDueToday')
        : row.kind === 'referral'
          ? t('modules.notifReferralFollowUp')
          : t('modules.notifImmunizationDue');

  return (
    <Card>
      <View className="flex-row items-start gap-3 p-4">
        <View className={cx('h-10 w-10 shrink-0 items-center justify-center rounded-full', SEVERITY_CLS[row.severity])}>
          <Icon name={KIND_ICON[row.kind]} size={20} color={row.severity === 'high' ? colors.onErrorContainer : colors.onSurface} />
        </View>

        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-body-md text-body-md font-semibold text-on-surface" numberOfLines={1}>
            {headline}
          </Text>
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
    </Card>
  );
}
