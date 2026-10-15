import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { Button, RiskChip } from '@/components/ui/Button';
import { Card, SectionHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { DateField, SelectField, TextField } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import {
  insertLocalPregnancy,
  listPatients,
  listPregnanciesWithPatient,
  type PatientRow,
  type PregnancyWithPatient,
} from '@/db/clinical';
import { enqueue } from '@/db/database';
import { useLocalization } from '@/i18n/useLocalization';
import { isCurrentlyOnline, scheduleSync } from '@/sync/network';
import { dateToIso } from '@/utils/date';

/**
 * Pregnancy Tracking, from the More menu.
 *
 * Backed by the `pregnancies` table the app already syncs, joined to the
 * beneficiary name in SQL (listPregnanciesWithPatient). Tapping a row opens the
 * same patient detail screen the Patients tab uses, so there is one clinical
 * record view rather than a second implementation.
 *
 * Registration mirrors the web's inline form: the button at the top reveals it
 * above the list, and the write is the module-form contract every screen here
 * uses — SQLite first, outbox second, upload whenever the network allows.
 * Trimester and week are collected by the web form but have no column on
 * either the local table or the server Pregnancy model, so they are left out
 * rather than captured and dropped by the server's `_clean_columns`.
 */
function newId(): string {
  // A local uuid is enough: the server upserts on this id and the same id is
  // reused as the idempotency anchor on retry.
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type Field = 'beneficiaryId' | 'dates';

/** The EDD is always ahead of today; the picker must be able to reach it. */
const EDD_MAX_ISO = dateToIso(new Date(Date.now() + 400 * 24 * 60 * 60 * 1000));

export default function PregnancyTrackingScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const toast = useToast();
  const [rows, setRows] = useState<PregnancyWithPatient[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [lmp, setLmp] = useState('');
  const [edd, setEdd] = useState('');
  const [risk, setRisk] = useState('low');
  const [riskReason, setRiskReason] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setRows(await listPregnanciesWithPatient());
      setStatus('ready');
    } catch {
      // A failed read must not leave a stale or empty list looking current.
      setRows([]);
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Only women can be enrolled, so the picker starts from the female half of
  // the local patient list rather than every beneficiary the web offers.
  useEffect(() => {
    void listPatients().then(setPatients);
  }, []);

  const patientOptions = useMemo(
    () =>
      patients
        .filter((patient) => patient.gender === 'female')
        .map((patient) => ({
          label: patient.household_hhid ? `${patient.full_name} · ${patient.household_hhid}` : patient.full_name,
          value: patient.id,
        })),
    [patients],
  );

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
    if (!beneficiaryId) next.beneficiaryId = t('asha.errPregnancyPatient');
    // The model allows either date alone, but a pregnancy with neither dates
    // the ANC schedule cannot be derived from — the field cannot act on it.
    if (!lmp && !edd) next.dates = t('asha.errPregnancyDates');
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
    const riskFactors = riskReason.trim() ? { reason: riskReason.trim() } : null;

    try {
      // Local commit first: the pregnancy is on the device immediately and
      // survives a crash, independent of the network.
      await insertLocalPregnancy({
        id,
        beneficiaryId,
        lmp: lmp || null,
        edd: edd || null,
        riskLevel: risk,
        riskFactors,
      });

      await enqueue({
        clientRequestId: `create-pregnancy-${id}`,
        entity: 'pregnancies',
        operation: 'create',
        recordId: id,
        version: 1,
        data: {
          id,
          beneficiary_id: beneficiaryId,
          lmp: lmp || null,
          edd: edd || null,
          risk_level: risk,
          risk_factors: riskFactors,
          anc_count: 0,
          status: 'ongoing',
        },
      });

      setBeneficiaryId('');
      setLmp('');
      setEdd('');
      setRisk('low');
      setRiskReason('');
      setErrors({});
      setShowForm(false);
      await load();

      if (online) scheduleSync(300);
      toast.toast(t('asha.pregnancySaved'), 'success');
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : t('asha.errPregnancySave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header="page"
      title={t('nav.pregnancyTracking')}
      back
      withTabBar={false}
      actions={<LanguageToggle onSurface />}
    >
      <View className="mb-4 gap-3">
        <Button
          label={showForm ? t('asha.closeForm') : t('asha.registerPregnancy')}
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
            <SectionHeader title={t('asha.registerPregnancy')} />
            <SelectField
              label={`${t('asha.selectPatient')} *`}
              value={beneficiaryId}
              onChange={(next) => setField('beneficiaryId', next, setBeneficiaryId)}
              errorText={errors.beneficiaryId ?? (patientOptions.length === 0 ? t('asha.noPatients') : undefined)}
              placeholder={t('asha.selectPatient')}
              options={patientOptions}
              searchable
            />
            <DateField
              label={t('asha.formLmp')}
              value={lmp}
              onChange={(next) => setField('dates', next, setLmp)}
              errorText={errors.dates}
              placeholder="DD/MM/YYYY"
              doneLabel={t('common.done')}
            />
            <DateField
              label={t('asha.formEdd')}
              value={edd}
              onChange={(next) => setField('dates', next, setEdd)}
              errorText={errors.dates}
              placeholder="DD/MM/YYYY"
              maxIso={EDD_MAX_ISO}
              doneLabel={t('common.done')}
            />
            <SelectField
              label={t('asha.riskAssessment')}
              value={risk}
              onChange={setRisk}
              options={[
                { label: t('asha.riskLowLabel'), value: 'low' },
                { label: t('asha.riskMediumLabel'), value: 'medium' },
                { label: t('asha.riskHighLabel'), value: 'high' },
              ]}
            />
            <TextField
              label={t('asha.riskReason')}
              value={riskReason}
              onChangeText={setRiskReason}
              placeholder={t('asha.formNotes')}
              autoCapitalize="sentences"
            />
            <Button
              label={t('asha.savePregnancy')}
              icon="save"
              full
              loading={busy}
              disabled={busy}
              onPress={() => void save()}
            />
          </View>
        </Card>
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
      ) : rows.length === 0 ? (
        <EmptyState icon="heart" title={t('asha.notPregnant')} />
      ) : (
        <View className="gap-3">
          {rows.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => router.push(`/patient/${row.beneficiary_id}`)}
            >
              <Card>
                <View className="gap-3 p-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="font-headline-md text-headline-md font-semibold text-on-surface" numberOfLines={1}>
                        {row.patient_name ?? '—'}
                      </Text>
                      {row.household_hhid ? (
                        <Text className="text-body-sm text-body-sm text-on-surface-variant">{row.household_hhid}</Text>
                      ) : null}
                    </View>
                    <RiskChip
                      level={(row.risk_level as 'low' | 'medium' | 'high') ?? 'low'}
                      label={
                        row.risk_level === 'high'
                          ? t('asha.riskHighLabel')
                          : row.risk_level === 'medium'
                            ? t('asha.riskMediumLabel')
                            : t('asha.riskLowLabel')
                      }
                    />
                  </View>

                  <View className="flex-row flex-wrap gap-x-6 gap-y-2">
                    <Meta label={t('asha.edd')} value={row.edd ?? '—'} />
                    <Meta label={t('asha.ancVisits')} value={row.anc_count ?? 0} />
                    <Meta label={t('asha.nextAncDue')} value={row.next_anc_due ?? '—'} />
                  </View>
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
