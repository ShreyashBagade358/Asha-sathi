import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/LoadingState';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';
import { colors } from '@/theme';
import { listFollowUps, type PatientFollowUp } from '@/patient/api';

const STATUS_TONES: Record<string, string> = {
  scheduled: 'bg-tertiary-container text-on-tertiary-container',
  pending: 'bg-tertiary-container text-on-tertiary-container',
  completed: 'bg-secondary-container text-on-secondary-container',
  overdue: 'bg-error-container text-on-error-container',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  pending: 'Pending',
  completed: 'Completed',
  overdue: 'Overdue',
};

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * My Follow-ups: upcoming tasks and referral follow-ups from the ASHA worker.
 * Reads from `/patients/me/follow-ups`.
 */
export default function PatientFollowUpsScreen() {
  const { t } = useLocalization();
  const [items, setItems] = useState<PatientFollowUp[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setItems(await listFollowUps());
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enriched = items.map((f) => ({
    ...f,
    effectiveStatus: isOverdue(f.due_date) && f.status !== 'completed' ? 'overdue' : f.status,
  }));

  return (
    <Screen>
      <View className="flex-1 gap-4 p-4">
        <View>
          <Text className="font-title-lg text-title-lg text-on-surface">
            {t('patient.followUpsTitle')}
          </Text>
          <Text className="mt-1 font-body-md text-body-md text-on-surface-variant">
            {t('patient.followUpsSubtitle')}
          </Text>
        </View>

        {status === 'loading' ? (
          <LoadingState />
        ) : status === 'failed' ? (
          <ErrorState message={t('common.errorMsg')} onRetry={() => void load()} />
        ) : enriched.length === 0 ? (
          <Card className="items-center py-8">
            <Icon name="checkCircle" size={40} color={colors.onSurfaceVariant} />
            <Text className="mt-3 font-body-lg text-body-lg text-on-surface-variant">
              {t('patient.noFollowUps')}
            </Text>
          </Card>
        ) : (
          enriched.map((item) => (
            <Card key={item.id} className="gap-3">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-row items-center gap-3 flex-1">
                  <View
                    className={cx(
                      'h-11 w-11 items-center justify-center rounded-full',
                      item.effectiveStatus === 'overdue'
                        ? 'bg-error-container'
                        : 'bg-primary-container',
                    )}
                  >
                    <Icon
                      name={item.type === 'referral' ? 'fileText' : 'checkCircle'}
                      size={22}
                      color={item.effectiveStatus === 'overdue' ? colors.error : colors.primary}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="font-title-sm text-title-sm text-on-surface" numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                      {item.type === 'referral'
                        ? t('patient.followUpReferral')
                        : t('patient.followUpTask')}
                      {item.due_date
                        ? ` · ${t('patient.followUpDue')}: ${formatDate(item.due_date)}`
                        : ''}
                    </Text>
                  </View>
                </View>
                <View
                  className={cx(
                    'rounded-full px-2.5 py-1',
                    STATUS_TONES[item.effectiveStatus] ?? STATUS_TONES.pending,
                  )}
                >
                  <Text className="font-body-sm text-body-sm font-semibold">
                    {STATUS_LABELS[item.effectiveStatus] ?? item.effectiveStatus}
                  </Text>
                </View>
              </View>
              {item.detail ? (
                <View className="border-t border-outline-variant/40 pt-3">
                  <Text className="font-body-md text-body-md text-on-surface">{item.detail}</Text>
                </View>
              ) : null}
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}
