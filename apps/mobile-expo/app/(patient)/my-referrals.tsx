import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card, Pill } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/LoadingState';
import { useToast } from '@/components/ui/Toast';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';
import { loadPatientReferrals } from '@/patient/referrals';
import type { PatientReferral, PatientReferralStatus } from '@/patient/types';

const STATUS_META: Record<PatientReferralStatus, { label: string; tone: string }> = {
  pending: { label: 'patient.refPending', tone: 'bg-tertiary-container text-on-tertiary-container' },
  accepted: { label: 'patient.refAccepted', tone: 'bg-secondary-container text-on-secondary-container' },
  completed: { label: 'patient.refCompleted', tone: 'bg-secondary-container text-on-secondary-container' },
  cancelled: { label: 'patient.refCancelled', tone: 'bg-surface-container-high text-on-surface-variant' },
};

const URGENCY_META: Record<PatientReferral['urgency'], { label: string; tone: string }> = {
  emergency: { label: 'patient.emergency', tone: 'bg-error-container text-on-error-container' },
  urgent: { label: 'patient.urgent', tone: 'bg-error-container text-on-error-container' },
  routine: { label: 'patient.routine', tone: 'bg-surface-container-high text-on-surface-variant' },
};

/**
 * My Referrals, ported from the web's PatientReferralsPage: status pills,
 * referral cards with urgency / status chips and the reason footer. Rows come
 * from the locally synced `referrals` table (see referrals.ts), which the sync
 * scope already restricts to this patient.
 */
export default function PatientMyReferralsScreen() {
  const { t } = useLocalization();
  const { toast } = useToast();
  const [rows, setRows] = useState<PatientReferral[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [filter, setFilter] = useState<'all' | PatientReferralStatus>('all');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setRows(await loadPatientReferrals());
      setStatus('ready');
    } catch {
      setRows([]);
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = rows.filter((r) => (filter === 'all' ? true : r.status === filter));

  const tabs: { key: 'all' | PatientReferralStatus; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: rows.length },
    { key: 'pending', label: t('patient.refPending'), count: rows.filter((r) => r.status === 'pending').length },
    { key: 'accepted', label: t('patient.refAccepted'), count: rows.filter((r) => r.status === 'accepted').length },
    { key: 'completed', label: t('patient.refCompleted'), count: rows.filter((r) => r.status === 'completed').length },
  ];

  return (
    <Screen
      title={t('patient.referralsTitle')}
      subtitle={t('patient.referralsSubtitle')}
      back
      withTabBar={false}
      actions={
        <Button
          label={t('patient.requestReferral')}
          icon="plus"
          shape="pill"
          onPress={() => toast(t('patient.referralToast'), 'success')}
          testID="request-referral"
        />
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
            <Card>
              <Text className="p-6 text-center text-body-md text-body-md text-on-surface-variant">
                {t('patient.noReferrals')}
              </Text>
            </Card>
          ) : (
            <View className="gap-3">
              {visible.map((referral) => {
                const statusMeta = STATUS_META[referral.status];
                const urgencyMeta = URGENCY_META[referral.urgency];
                return (
                  <Card key={referral.id}>
                    <View className="flex-row items-start justify-between gap-3 p-4">
                      <View className="min-w-0 flex-1 flex-row items-center gap-3">
                        <View className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container">
                          <Icon name="activity" size={22} />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="text-label-md text-label-md font-semibold text-on-surface" numberOfLines={1}>
                            {t('patient.refTo')}: {referral.toFacility}
                          </Text>
                          <Text className="text-caption text-caption text-on-surface-variant" numberOfLines={1}>
                            {referral.date} · {t('patient.referredBy')}: {referral.referredBy}
                          </Text>
                        </View>
                      </View>
                      <View className="shrink-0 items-end gap-1">
                        <View className={cx('rounded-full px-2.5 py-1', urgencyMeta.tone)}>
                          <Text className="text-caption text-caption font-semibold">{t(urgencyMeta.label)}</Text>
                        </View>
                        <View className={cx('rounded-full px-2.5 py-1', statusMeta.tone)}>
                          <Text className="text-caption text-caption font-semibold">{t(statusMeta.label)}</Text>
                        </View>
                      </View>
                    </View>

                    <View className="gap-1.5 border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-3">
                      <Text className="text-caption text-caption text-on-surface-variant">
                        {t('patient.refReason')}
                      </Text>
                      <Text className="text-body-md text-body-md font-medium text-on-surface">
                        {referral.reason}
                      </Text>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
