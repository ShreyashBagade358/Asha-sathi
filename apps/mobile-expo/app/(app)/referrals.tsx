import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { tokenStore } from '@/auth/tokenStore';
import { Button } from '@/components/ui/Button';
import { Card, Pill, SectionHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectField, TextField } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import {
  insertLocalReferral,
  insertLocalReferralFollowup,
  listPatients,
  listReferralFollowups,
  listReferralsWithPatient,
  type PatientRow,
  type ReferralWithPatient,
} from '@/db/clinical';
import { enqueue } from '@/db/database';
import { useLocalization } from '@/i18n/useLocalization';
import { isCurrentlyOnline, scheduleSync } from '@/sync/network';
import { todayIso } from '@/utils/date';

/**
 * Referrals, from the More menu.
 *
 * `referrals` is one of the tables the app syncs, so this is a real list. The
 * seed data has none, which is why the empty state is the web's
 * "No referrals found" copy rather than a generic placeholder.
 *
 * Two additions on top of the read: the create form the web's New Referral
 * page offers (same four inputs, written the offline-first way), and the
 * status tabs the web referrals page filters by. The server column
 * `referral_type` is free text but the web form fixes it to `general`, so
 * this form does too rather than inventing a second taxonomy offline.
 *
 * The facility fields are the one place this diverges from the API schema:
 * `ReferralCreate` drops free-text `referred_to`/`referred_from` (the IDs are
 * meant to reference a facility directory the app does not have offline), so
 * what the ASHA types here lands in the facility id columns — the same
 * strings the fixture already stores, like `CHC-LKO-01`.
 */

function newId(): string {
  // A local uuid is enough: the server upserts on this id and the same id is
  // reused as the idempotency anchor on retry.
  return `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

type Field = 'beneficiaryId' | 'reason' | 'toFacility';
type FilterKey = 'all' | 'pending' | 'accepted' | 'completed';

/**
 * The web's status table: anything not accepted/completed/cancelled renders
 * as Pending, which is also how `initiated` — the value this form writes —
 * must read for the fixture's `pending` rows to sit in one bucket.
 */
function normalizeStatus(status: string | null | undefined): string {
  const value = (status ?? '').trim().toLowerCase();
  if (!value || value === 'initiated') return 'pending';
  return value;
}

export default function ReferralsScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const toast = useToast();
  const [rows, setRows] = useState<ReferralWithPatient[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [filter, setFilter] = useState<FilterKey>('all');

  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [urgency, setUrgency] = useState('routine');
  const [reason, setReason] = useState('');
  const [fromFacility, setFromFacility] = useState('');
  const [toFacility, setToFacility] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Record Follow-up — offline-first like the create form above.
  const [recording, setRecording] = useState<{ referralId: string; patient: string } | null>(null);
  const [fuDate, setFuDate] = useState(todayIso());
  const [fuStatus, setFuStatus] = useState('');
  const [fuCompliance, setFuCompliance] = useState('');
  const [fuNotes, setFuNotes] = useState('');
  const [fuBusy, setFuBusy] = useState(false);
  const [fuError, setFuError] = useState<string | null>(null);
  const [fuCount, setFuCount] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const referralRows = await listReferralsWithPatient();
      setRows(referralRows);
      // One follow-up read per referral keeps the count chips honest offline.
      const counts: Record<string, number> = {};
      for (const row of referralRows) {
        counts[row.id] = (await listReferralFollowups(row.id)).length;
      }
      setFuCount(counts);
      setStatus('ready');
    } catch {
      // A failed read must not leave a stale or empty list looking current.
      setRows([]);
      setFuCount({});
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listPatients().then(setPatients);
  }, []);

  const patientOptions = useMemo(
    () =>
      patients.map((patient) => ({
        label: patient.household_hhid ? `${patient.full_name} · ${patient.household_hhid}` : patient.full_name,
        value: patient.id,
      })),
    [patients],
  );

  const counts = useMemo(() => {
    const next: Record<FilterKey, number> = { all: rows.length, pending: 0, accepted: 0, completed: 0 };
    for (const row of rows) {
      const key = normalizeStatus(row.status);
      if (key in next) next[key as FilterKey] += 1;
    }
    return next;
  }, [rows]);

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((row) => normalizeStatus(row.status) === filter)),
    [rows, filter],
  );

  function statusLabel(value: string | null | undefined): string {
    const key = normalizeStatus(value);
    if (key === 'pending') return t('asha.refPending');
    if (key === 'accepted') return t('asha.refAccepted');
    if (key === 'completed') return t('asha.refCompleted');
    if (key === 'cancelled') return t('asha.refCancelled');
    return value ?? '—';
  }

  /** Mirror of the register screen's `set()`: writing a field clears its error. */
  const setField = <K extends Field>(key: K, value: string, assign: (next: string) => void) => {
    assign(value);
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  function validate(): Partial<Record<Field, string>> {
    const next: Partial<Record<Field, string>> = {};
    if (!beneficiaryId) next.beneficiaryId = t('asha.errReferralPatient');
    if (!reason.trim()) next.reason = t('asha.errReferralReason');
    // The destination is what makes this actionable; the web requires it too.
    if (!toFacility.trim()) next.toFacility = t('asha.errReferralToFacility');
    return next;
  }

  async function save() {
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setBusy(true);
    setSaveError(null);

    const id = newId();
    const online = isCurrentlyOnline();
    const initiatedAt = new Date().toISOString();

    try {
      // The referrer is whoever is signed in, matching the web's
      // referred_from on create.
      const user = await tokenStore.getUser();
      const referredFromId = user?.id ?? null;

      // Local commit first: the referral is on the device immediately and
      // survives a crash, independent of the network.
      await insertLocalReferral({
        id,
        beneficiaryId,
        referralType: 'general',
        urgency,
        reason: reason.trim(),
        referredFromId,
        referredFromFacilityId: fromFacility.trim() || null,
        referredToFacilityId: toFacility.trim() || null,
        initiatedAt,
      });

      await enqueue({
        clientRequestId: `create-referral-${id}`,
        entity: 'referrals',
        operation: 'create',
        recordId: id,
        version: 1,
        data: {
          id,
          beneficiary_id: beneficiaryId,
          referral_type: 'general',
          urgency,
          reason: reason.trim(),
          referred_from_id: referredFromId,
          referred_from_facility_id: fromFacility.trim() || null,
          referred_to_facility_id: toFacility.trim() || null,
          status: 'initiated',
          initiated_at: initiatedAt,
          followup_required: false,
        },
      });

      setBeneficiaryId('');
      setUrgency('routine');
      setReason('');
      setFromFacility('');
      setToFacility('');
      setErrors({});
      setShowForm(false);
      await load();

      if (online) scheduleSync(300);
      toast.toast(t('asha.referralCreated'), 'success');
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : t('asha.errReferralSave'));
    } finally {
      setBusy(false);
    }
  }

  function openRecord(row: ReferralWithPatient) {
    setRecording({ referralId: row.id, patient: row.patient_name ?? '—' });
    setFuDate(todayIso());
    setFuStatus('');
    setFuCompliance('');
    setFuNotes('');
    setFuError(null);
  }

  async function saveFollowup() {
    if (!recording) return;
    setFuBusy(true);
    setFuError(null);
    const id = `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const user = await tokenStore.getUser();
    try {
      await insertLocalReferralFollowup({
        id,
        referralId: recording.referralId,
        followupDate: fuDate,
        conductedBy: user?.id ?? null,
        beneficiaryStatus: fuStatus || null,
        treatmentCompliance: fuCompliance || null,
        notes: fuNotes.trim() || null,
      });
      await enqueue({
        clientRequestId: `create-referral-followup-${id}`,
        entity: 'referral_followups',
        operation: 'create',
        recordId: id,
        version: 1,
        data: {
          id,
          referral_id: recording.referralId,
          followup_date: fuDate,
          conducted_by: user?.id ?? null,
          beneficiary_status: fuStatus || null,
          treatment_compliance: fuCompliance || null,
          notes: fuNotes.trim() || null,
          version: 1,
        },
      });
      setRecording(null);
      await load();
      if (isCurrentlyOnline()) scheduleSync(300);
      toast.toast(t('asha.fuSaved'), 'success');
    } catch (err) {
      setFuError(err instanceof Error && err.message ? err.message : t('asha.fuSaveError'));
    } finally {
      setFuBusy(false);
    }
  }

  return (
    <Screen
      header="page"
      title={t('nav.referrals')}
      back
      withTabBar={false}
      actions={<LanguageToggle onSurface />}
    >
      <View className="mb-4 gap-3">
        <Button
          label={showForm ? t('asha.closeForm') : t('asha.newReferral')}
          icon={showForm ? 'x' : 'plus'}
          full
          onPress={() => {
            setShowForm((value) => !value);
            setSaveError(null);
          }}
        />
        {saveError ? (
          <View className="flex-row items-center gap-2 rounded-xl bg-error-container px-3 py-2.5">
            <Text className="min-w-0 flex-1 text-body-sm text-body-sm text-on-error-container">{saveError}</Text>
          </View>
        ) : null}
      </View>

      {showForm ? (
        <Card className="mb-5">
          <View className="gap-3 p-4">
            <SectionHeader title={t('asha.newReferral')} />
            <SelectField
              label={`${t('asha.selectPatient')} *`}
              value={beneficiaryId}
              onChange={(next) => setField('beneficiaryId', next, setBeneficiaryId)}
              errorText={errors.beneficiaryId ?? (patientOptions.length === 0 ? t('asha.noPatients') : undefined)}
              placeholder={t('asha.selectPatient')}
              options={patientOptions}
              searchable
            />
            <SelectField
              label={t('patient.urgency')}
              value={urgency}
              onChange={setUrgency}
              options={[
                { label: t('asha.refUrgencyRoutine'), value: 'routine' },
                { label: t('asha.refUrgencyUrgent'), value: 'urgent' },
                { label: t('asha.refUrgencyEmergency'), value: 'emergency' },
              ]}
            />
            <TextField
              label={`${t('asha.formReason')} *`}
              value={reason}
              onChangeText={(next) => setField('reason', next, setReason)}
              errorText={errors.reason}
              placeholder={t('patient.refReason')}
              multiline
              autoCapitalize="sentences"
            />
            <TextField
              label={t('asha.formFromFacility')}
              value={fromFacility}
              onChangeText={setFromFacility}
              placeholder="CHC-LKO-01"
              autoCapitalize="characters"
            />
            <TextField
              label={`${t('asha.formToFacility')} *`}
              value={toFacility}
              onChangeText={(next) => setField('toFacility', next, setToFacility)}
              errorText={errors.toFacility}
              placeholder="CHC-LKO-01"
              autoCapitalize="characters"
            />
            <Button
              label={t('asha.createReferral')}
              icon="save"
              full
              loading={busy}
              disabled={busy}
              onPress={() => void save()}
            />
          </View>
        </Card>
      ) : null}

      {recording ? (
        <Card className="mb-5">
          <View className="gap-3 p-4">
            <SectionHeader title={t('asha.fuRecordTitle')} />
            <Text className="text-caption text-caption text-on-surface-variant">
              {recording.patient}
            </Text>
            <TextField
              label={`${t('asha.fuDate')} *`}
              value={fuDate}
              onChangeText={setFuDate}
              placeholder="YYYY-MM-DD"
            />
            <SelectField
              label={t('asha.fuPatientStatus')}
              value={fuStatus}
              onChange={setFuStatus}
              options={[
                { label: t('asha.fuStatusRecovered'), value: 'recovered' },
                { label: t('asha.fuStatusImproving'), value: 'improving' },
                { label: t('asha.fuStatusStable'), value: 'stable' },
                { label: t('asha.fuStatusWorsened'), value: 'worsened' },
              ]}
            />
            <SelectField
              label={t('asha.fuCompliance')}
              value={fuCompliance}
              onChange={setFuCompliance}
              options={[
                { label: t('asha.fuComplianceFull'), value: 'full' },
                { label: t('asha.fuCompliancePartial'), value: 'partial' },
                { label: t('asha.fuComplianceNone'), value: 'none' },
              ]}
            />
            <TextField
              label={t('asha.fuNotes')}
              value={fuNotes}
              onChangeText={setFuNotes}
              placeholder={t('asha.fuNotes')}
              multiline
              autoCapitalize="sentences"
            />
            {fuError ? (
              <View className="flex-row items-center gap-2 rounded-xl bg-error-container px-3 py-2.5">
                <Text className="min-w-0 flex-1 text-body-sm text-body-sm text-on-error-container">{fuError}</Text>
              </View>
            ) : null}
            <View className="flex-row gap-3">
              <Button
                label={t('common.cancel')}
                variant="ghost"
                shape="pill"
                onPress={() => setRecording(null)}
              />
              <Button
                label={t('common.save')}
                icon="check"
                full
                loading={fuBusy}
                disabled={fuBusy}
                onPress={() => void saveFollowup()}
              />
            </View>
          </View>
        </Card>
      ) : null}

      <Tabs
        className="mb-4"
        active={filter}
        onChange={(key) => setFilter(key as FilterKey)}
        tabs={[
          { key: 'all', label: `${t('asha.filterAll')} (${counts.all})` },
          { key: 'pending', label: `${t('asha.refPending')} (${counts.pending})` },
          { key: 'accepted', label: `${t('asha.refAccepted')} (${counts.accepted})` },
          { key: 'completed', label: `${t('asha.refCompleted')} (${counts.completed})` },
        ]}
      />

      {status === 'failed' ? (
        <EmptyState
          icon="alertCircle"
          title={t('common.errorTitle')}
          description={t('common.errorMsg')}
          action={<Button label={t('common.retry')} onPress={() => void load()} />}
        />
      ) : status === 'loading' ? (
        <EmptyState icon="inbox" title={t('common.loading')} />
      ) : rows.length === 0 ? (
        <EmptyState icon="fileText" title={t('patient.noReferrals')} />
      ) : visible.length === 0 ? (
        <EmptyState icon="inbox" title={t('common.noData')} />
      ) : (
        <View className="gap-3">
          {visible.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => router.push(`/patient/${row.beneficiary_id}`)}
            >
              <Card>
                <View className="gap-3 p-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <Text className="flex-1 font-headline-md text-headline-md font-semibold text-on-surface" numberOfLines={1}>
                      {row.patient_name ?? '—'}
                    </Text>
                    <Pill
                      label={
                        row.urgency === 'emergency'
                          ? t('patient.emergency')
                          : row.urgency === 'urgent'
                            ? t('patient.urgent')
                            : t('patient.routine')
                      }
                      active={row.urgency === 'emergency'}
                    />
                  </View>

                  <View className="gap-1">
                    <Text className="text-caption text-caption text-on-surface-variant">{t('patient.refReason')}</Text>
                    <Text className="text-body-md text-body-md text-on-surface">{row.reason ?? '—'}</Text>
                  </View>

                  <View className="flex-row flex-wrap gap-x-6 gap-y-2">
                    <Meta label={t('common.status')} value={statusLabel(row.status)} />
                    {row.referred_to_facility_id ? (
                      <Meta label={t('asha.referredTo')} value={row.referred_to_facility_id} />
                    ) : null}
                    {row.initiated_at ? <Meta label={t('common.date')} value={row.initiated_at} /> : null}
                    <Meta label={t('asha.fuRecordTitle')} value={fuCount[row.id] ?? 0} />
                  </View>

                  <Button
                    label={t('asha.fuRecord')}
                    icon="check"
                    variant="secondary"
                    onPress={() => openRecord(row)}
                  />
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

function Meta({ label, value }: { label: string; value: string | number }) {
  return (
    <View>
      <Text className="text-caption text-caption text-on-surface-variant">{label}</Text>
      <Text className="text-body-md text-body-md font-semibold text-on-surface">{value}</Text>
    </View>
  );
}
