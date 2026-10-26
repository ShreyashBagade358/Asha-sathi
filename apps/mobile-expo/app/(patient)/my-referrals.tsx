import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card, Pill } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';
import { loadPatientReferrals } from '@/patient/referrals';
import { createReferralRequest, listReferralRequests } from '@/patient/api';
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

const REFERRAL_TYPES = [
  { value: 'general', label: 'General Medicine' },
  { value: 'specialist', label: 'Specialist Review' },
  { value: 'maternal', label: 'Maternal / Obstetric' },
  { value: 'child', label: 'Child Health' },
  { value: 'emergency', label: 'Emergency / Trauma' },
];

/**
 * My Referrals: reads from the locally synced `referrals` table (offline-safe)
 * and falls back to / merges with the live API. The Request Referral button
 * opens a real form that POSTs to `/patients/me/referral-requests`.
 */
export default function PatientMyReferralsScreen() {
  const { t } = useLocalization();
  const { toast } = useToast();
  const [rows, setRows] = useState<PatientReferral[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [filter, setFilter] = useState<'all' | PatientReferralStatus>('all');

  // Request Referral modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [refType, setRefType] = useState('');
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      // Try the live API first (freshest data); fall back to local sync.
      try {
        const apiRows = await listReferralRequests();
        if (apiRows.length > 0) {
          setRows(apiRows.map((r) => ({
            id: r.id,
            toFacility: r.referral_type,
            referredBy: r.asha_worker_name ?? '—',
            date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
            urgency: r.urgency,
            status: r.status,
            reason: r.reason,
          })));
          setStatus('ready');
          return;
        }
      } catch {
        // API unreachable — fall through to local sync
      }
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

  const submitReferral = useCallback(async () => {
    if (!refType || !reason.trim()) {
      setFormError('Please select a type and enter a reason.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createReferralRequest({
        referralType: refType,
        urgency,
        reason: reason.trim(),
      });
      toast(t('patient.referralToast'), 'success');
      setModalOpen(false);
      setRefType('');
      setUrgency('routine');
      setReason('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit referral request.');
    } finally {
      setSubmitting(false);
    }
  }, [refType, urgency, reason, toast, t, load]);

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
          onPress={() => setModalOpen(true)}
          testID="request-referral"
        />
      }
    >
      {/* Request Referral modal */}
      <Modal visible={modalOpen} onClose={() => setModalOpen(false)} title={t('patient.requestReferral')}>
        <View className="gap-4 pb-2">
          <SelectField
            label="Referral Type"
            value={refType}
            options={REFERRAL_TYPES.map((r) => ({ label: r.label, value: r.value }))}
            onChange={setRefType}
            placeholder="Select type..."
            errorText={formError && !refType ? 'Please select a type' : undefined}
          />

          <View>
            <Text className="text-label-md font-semibold text-on-surface mb-1.5">
              {t('patient.urgency')}
            </Text>
            <View className="flex-row gap-2">
              {(['routine', 'urgent', 'emergency'] as const).map((u) => (
                <Button
                  key={u}
                  label={t(`patient.${u}`)}
                  shape="pill"
                  variant={urgency === u ? 'primary' : 'ghost'}
                  onPress={() => setUrgency(u)}
                  className="flex-1"
                />
              ))}
            </View>
          </View>

          <TextField
            label={t('patient.refReason')}
            value={reason}
            onChangeText={setReason}
            placeholder="Describe your symptoms or reason..."
            multiline
            numberOfLines={3}
          />

          {formError ? (
            <Text className="text-caption text-error">{formError}</Text>
          ) : null}

          <Button
            label={t('patient.requestReferral')}
            icon="plus"
            shape="pill"
            full
            loading={submitting}
            onPress={() => void submitReferral()}
            testID="submit-referral"
          />
        </View>
      </Modal>

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
