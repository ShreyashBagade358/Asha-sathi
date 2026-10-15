import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card, Pill } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { DateField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import { listFollowUps, setFollowUpDate, setFollowUpDone, type FollowUp } from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';
import { dateToIso } from '@/utils/date';
import { cx } from '@/cx';

type Filter = 'all' | 'overdue' | 'upcoming';

const SOURCE_CLS: Record<FollowUp['kind'], string> = {
  referral: 'bg-tertiary-fixed text-on-tertiary-fixed',
  task: 'bg-primary-container text-on-primary',
};

/** Rescheduling only ever pushes a deadline forward, so the picker runs to next year. */
const NEXT_YEAR_LIMIT_ISO = dateToIso(new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate()));

/**
 * Follow-up, from the More menu.
 *
 * The web kept scheduled and completed visits in a mock array. Here the list is
 * what the worker actually owes: outstanding tasks plus every referral flagged
 * `followup_required`, both of which already come down the sync feed.
 *
 * Each row can be closed or moved: Complete asks for confirmation (it takes
 * the row off the open list), Reschedule asks for a new date. Both write
 * through `setFollowUpDone`/`setFollowUpDate`, so the change lands in SQLite
 * and the outbox before the list reloads — a reschedule typed with no signal
 * still travels when the network returns.
 */
export default function FollowUpsScreen() {
  const { t } = useLocalization();
  const toast = useToast();
  const [rows, setRows] = useState<FollowUp[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rescheduleRow, setRescheduleRow] = useState<FollowUp | null>(null);
  const [nextDate, setNextDate] = useState('');
  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setRows(await listFollowUps());
      setStatus('ready');
    } catch {
      // A failed read must not leave the previous list on screen pretending it
      // is current.
      setRows([]);
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A NULL due date is a promise with no date attached, which is not overdue.
  const overdue = (row: FollowUp) => row.due_date !== null && row.due_date < today;
  const visible = rows.filter((row) =>
    filter === 'all' ? true : filter === 'overdue' ? overdue(row) : !overdue(row),
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      overdue: rows.filter(overdue).length,
      upcoming: rows.filter((row) => !overdue(row)).length,
    }),
    [rows, today],
  );

  const complete = async (row: FollowUp) => {
    if (busyId) return;
    setBusyId(row.id);
    try {
      // Local write + outbox first, then the list reflects it.
      await setFollowUpDone(row, true);
      await load();
      toast.toast(t('asha.fuDoneToast'), 'success');
    } catch (err) {
      toast.toast(err instanceof Error && err.message ? err.message : t('asha.fuActionFailed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmComplete = (row: FollowUp) => {
    Alert.alert(t('asha.fuCompleteTitle'), t('asha.fuCompleteMsg', { name: row.patient_name ?? '—' }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('asha.fuComplete'), onPress: () => void complete(row) },
    ]);
  };

  const openReschedule = (row: FollowUp) => {
    setNextDate(row.due_date && row.due_date >= today ? row.due_date : today);
    setDateError(undefined);
    setRescheduleRow(row);
  };

  const closeReschedule = () => {
    if (rescheduleBusy) return;
    setRescheduleRow(null);
    setNextDate('');
    setDateError(undefined);
  };

  const reschedule = async () => {
    const row = rescheduleRow;
    if (!row) return;
    if (!nextDate) {
      setDateError(t('asha.fuRescheduleRequired'));
      return;
    }

    setRescheduleBusy(true);
    try {
      await setFollowUpDate(row, nextDate);
      setRescheduleRow(null);
      setNextDate('');
      setDateError(undefined);
      await load();
      toast.toast(t('asha.fuRescheduled'), 'success');
    } catch (err) {
      toast.toast(err instanceof Error && err.message ? err.message : t('asha.fuActionFailed'), 'error');
    } finally {
      setRescheduleBusy(false);
    }
  };


  return (
    <Screen
      header="page"
      title={t('asha.followUpTitle')}
      back
      withTabBar={false}
      actions={<LanguageToggle onSurface />}
    >
      {status === 'ready' && rows.length > 0 ? (
        <>
          <View className="-mx-1 mb-4 flex-row flex-wrap gap-2">
            <View className="w-[46%] grow px-1">
              <StatCard label={t('asha.followUpTitle')} value={counts.all} icon="calendar" />
            </View>
            <View className="w-[46%] grow px-1">
              <StatCard label={t('modules.followUpsOverdue')} value={counts.overdue} icon="alert" tone="error" />
            </View>
            <View className="w-[46%] grow px-1">
              <StatCard label={t('modules.followUpsUpcoming')} value={counts.upcoming} icon="checkCircle" tone="secondary" />
            </View>
          </View>

          <View className="mb-4 flex-row flex-wrap gap-2">
            {(['all', 'overdue', 'upcoming'] as Filter[]).map((key) => (
              <Pill
                key={key}
                label={
                  key === 'all'
                    ? t('modules.followUpsAll')
                    : key === 'overdue'
                      ? t('modules.followUpsOverdue')
                      : t('modules.followUpsUpcoming')
                }
                count={counts[key]}
                active={filter === key}
                onPress={() => setFilter(key)}
              />
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
          title={filter === 'all' ? t('modules.followUpsEmpty') : t('common.noResults')}
          description={filter === 'all' ? t('modules.followUpsEmptyHint') : undefined}
        />
      ) : (
        <View className="gap-3">
          {visible.map((row) => (
            <FollowUpCard
              key={row.id}
              row={row}
              overdue={overdue(row)}
              busy={busyId === row.id}
              onComplete={() => confirmComplete(row)}
              onReschedule={() => openReschedule(row)}
            />
          ))}
        </View>
      )}

      <Modal visible={rescheduleRow !== null} onClose={closeReschedule} title={t('asha.fuRescheduleTitle')}>
        <View className="gap-3">
          <Text className="text-body-sm text-body-sm text-on-surface-variant" numberOfLines={2}>
            {`${rescheduleRow?.patient_name ?? '—'}${rescheduleRow?.due_date ? ` · ${t('modules.followUpDue')} ${rescheduleRow.due_date}` : ''}`}
          </Text>
          <DateField
            label={t('asha.fuRescheduleDate')}
            value={nextDate}
            onChange={(iso) => {
              setNextDate(iso);
              setDateError(undefined);
            }}
            errorText={dateError}
            minIso={today}
            maxIso={NEXT_YEAR_LIMIT_ISO}
            doneLabel={t('common.done')}
          />
          <Button
            label={t('asha.fuRescheduleSave')}
            icon="calendar"
            full
            loading={rescheduleBusy}
            disabled={rescheduleBusy}
            onPress={() => void reschedule()}
          />
        </View>
      </Modal>
    </Screen>
  );
}

function FollowUpCard({
  row,
  overdue,
  busy,
  onComplete,
  onReschedule,
}: {
  row: FollowUp;
  overdue: boolean;
  busy: boolean;
  onComplete: () => void;
  onReschedule: () => void;
}) {
  const { t } = useLocalization();
  const initial = (row.patient_name ?? '').trim().charAt(0).toUpperCase();

  return (
    <Card rail={overdue ? '#BA1A1A' : '#006e28'}>
      <View className="flex-row items-start gap-3 p-4">
        <View className="h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-container">
          <Text className="font-headline-md text-headline-md font-bold text-on-primary-container">
            {initial || '—'}
          </Text>
        </View>

        <View className="min-w-0 flex-1 gap-2">
          <View className="gap-1">
            <Text className="font-headline-md text-headline-md font-semibold text-on-surface" numberOfLines={1}>
              {row.patient_name ?? '—'}
            </Text>
            <View className="flex-row flex-wrap items-center gap-2">
              {row.household_hhid ? (
                <Text className="text-caption text-caption text-on-surface-variant" numberOfLines={1}>
                  {row.household_hhid}
                </Text>
              ) : null}
              <View className={cx('rounded-full px-2 py-0.5', SOURCE_CLS[row.kind])}>
                <Text className="text-[11px] font-semibold" numberOfLines={1}>
                  {row.kind === 'task' ? t('modules.followUpsFromTask') : t('modules.followUpsFromReferral')}
                </Text>
              </View>
            </View>
          </View>

          <Text className="text-body-sm text-body-sm text-on-surface" numberOfLines={2}>
            {row.title}
          </Text>
          {row.detail ? (
            <Text className="text-body-sm text-body-sm text-on-surface-variant" numberOfLines={2}>
              {row.detail}
            </Text>
          ) : null}

          <View className="flex-row flex-wrap items-center gap-2">
            {row.due_date ? (
              <View
                className={cx(
                  'flex-row items-center gap-1.5 rounded-full px-2.5 py-1',
                  overdue ? 'bg-error-container' : 'bg-surface-container-high',
                )}
              >
                <Icon name={overdue ? 'alert' : 'calendar'} size={13} />
                <Text
                  className={cx(
                    'text-[11px] font-semibold',
                    overdue ? 'text-on-error-container' : 'text-on-surface-variant',
                  )}
                >
                  {`${overdue ? t('modules.followUpOverdueBy') : t('modules.followUpDue')} ${row.due_date}`}
                </Text>
              </View>
            ) : null}
            {row.urgency ? (
              <View className="rounded-full bg-surface-container px-2.5 py-1">
                <Text className="text-[11px] font-semibold text-on-surface-variant" numberOfLines={1}>
                  {row.urgency}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              label={t('asha.fuComplete')}
              icon="check"
              variant="primary"
              loading={busy}
              disabled={busy}
              onPress={onComplete}
            />
            <Button
              className="flex-1"
              label={t('asha.fuReschedule')}
              icon="calendar"
              variant="secondary"
              disabled={busy}
              onPress={onReschedule}
            />
          </View>
        </View>
      </View>
    </Card>
  );
}
