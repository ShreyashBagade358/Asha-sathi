import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectField, TextField } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import {
  getVaccinationSummary,
  insertLocalChild,
  listChildrenWithParent,
  listGrowthRecords,
  listPatients,
  type ChildWithParent,
  type GrowthRecord,
  type PatientRow,
  type VaccinationSummary,
} from '@/db/clinical';
import { enqueue } from '@/db/database';
import { useLocalization } from '@/i18n/useLocalization';
import { isCurrentlyOnline, scheduleSync } from '@/sync/network';
import { dateToIso } from '@/utils/date';

/**
 * Child Health, from the More menu.
 *
 * Lists child-aged beneficiaries (whatever the `children` table holds) so a
 * child registered on this device shows up before the server pull lands. Each
 * row also loads that child's most recent growth record, because weight/height/
 * nutrition status is what a field worker scans for; without a record the row
 * shows the birth details only rather than inventing a value. Dose counts come
 * from the child's immunization schedule when one exists.
 *
 * Registration mirrors the web's inline form: the child, mother and father are
 * selects over local beneficiaries, because `children` only links them — name,
 * date of birth, household and village all live on the child's beneficiaries
 * row (the server Child model has no such columns), which is why this form
 * shows them as read-only context instead of collecting them again.
 */
function newId(): string {
  // A local uuid is enough: the server upserts on this id and the same id is
  // reused as the idempotency anchor on retry.
  return `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

type Field = 'childId' | 'motherId' | 'birthWeight' | 'birthLength' | 'gestationWeeks';

/** The child list's own age test, in JS: under 5 by age columns or by DOB. */
function isChildAged(patient: PatientRow, fiveYearsAgoIso: string): boolean {
  if (patient.age_years != null) return patient.age_years < 5;
  if (patient.age_months != null) return patient.age_months < 60;
  return patient.date_of_birth != null && patient.date_of_birth > fiveYearsAgoIso;
}

export default function ChildHealthScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const toast = useToast();
  const [rows, setRows] = useState<
    (ChildWithParent & { latest_growth: GrowthRecord | null; vaccination: VaccinationSummary | null })[]
  >([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [childId, setChildId] = useState('');
  const [motherId, setMotherId] = useState('');
  const [fatherId, setFatherId] = useState('');
  const [birthWeight, setBirthWeight] = useState('');
  const [birthLength, setBirthLength] = useState('');
  const [gestationWeeks, setGestationWeeks] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const children = await listChildrenWithParent();
      const withDetails = await Promise.all(
        children.map(async (child) => {
          // Growth records and immunization schedules hang off the `children`
          // row, which a locally registered child does not have yet; without an
          // id there is nothing to look up.
          const [records, vaccination] = child.id
            ? await Promise.all([listGrowthRecords(child.id), getVaccinationSummary(child.id)])
            : ([null, null] as const);
          return { ...child, latest_growth: records?.at(-1) ?? null, vaccination };
        }),
      );
      setRows(withDetails);
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

  useEffect(() => {
    void listPatients().then(setPatients);
  }, []);

  const fiveYearsAgoIso = useMemo(
    () => dateToIso(new Date(new Date().getFullYear() - 5, new Date().getMonth(), new Date().getDate())),
    [],
  );

  const childOptions = useMemo(
    () =>
      patients
        .filter((patient) => isChildAged(patient, fiveYearsAgoIso))
        .map((patient) => ({
          label: patient.household_hhid ? `${patient.full_name} · ${patient.household_hhid}` : patient.full_name,
          value: patient.id,
        })),
    [patients, fiveYearsAgoIso],
  );

  const motherOptions = useMemo(
    () =>
      patients
        .filter((patient) => patient.gender === 'female')
        .map((patient) => ({ label: patient.full_name, value: patient.id })),
    [patients],
  );

  const fatherOptions = useMemo(
    () =>
      patients
        .filter((patient) => patient.gender === 'male')
        .map((patient) => ({ label: patient.full_name, value: patient.id })),
    [patients],
  );

  /** The child's own record: DOB and household sit on the beneficiary row. */
  const selectedChild = useMemo(() => patients.find((patient) => patient.id === childId) ?? null, [patients, childId]);

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
    if (!childId) next.childId = t('asha.errChildPatient');
    // The API layer refuses a child without her mother.
    if (!motherId) next.motherId = t('asha.errChildMother');
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
    const weight = birthWeight === '' ? null : Number(birthWeight);
    const length = birthLength === '' ? null : Number(birthLength);
    const weeks = gestationWeeks === '' ? null : Number(gestationWeeks);

    try {
      // Local commit first: the child row is visible immediately and survives
      // a crash, independent of the network.
      await insertLocalChild({
        id,
        beneficiaryId: childId,
        motherId,
        fatherId: fatherId || null,
        birthWeightGrams: weight,
        birthLengthCm: length,
        gestationWeeks: weeks,
      });

      await enqueue({
        clientRequestId: `create-child-${id}`,
        entity: 'children',
        operation: 'create',
        recordId: id,
        version: 1,
        data: {
          id,
          beneficiary_id: childId,
          mother_id: motherId,
          father_id: fatherId || null,
          birth_weight_grams: weight,
          birth_length_cm: length,
          gestation_weeks: weeks,
        },
      });

      setChildId('');
      setMotherId('');
      setFatherId('');
      setBirthWeight('');
      setBirthLength('');
      setGestationWeeks('');
      setErrors({});
      setShowForm(false);
      await load();

      if (online) scheduleSync(300);
      toast.toast(t('asha.childSaved'), 'success');
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : t('asha.errChildSave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header="page"
      title={t('nav.childHealth')}
      back
      withTabBar={false}
      actions={<LanguageToggle onSurface />}
    >
      <View className="mb-4 gap-3">
        <Button
          label={showForm ? t('asha.closeForm') : t('asha.registerChild')}
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
            <SectionHeader title={t('asha.registerChild')} />
            <SelectField
              label={`${t('asha.selectChild')} *`}
              value={childId}
              onChange={(next) => setField('childId', next, setChildId)}
              errorText={errors.childId ?? (childOptions.length === 0 ? t('asha.noPatients') : undefined)}
              placeholder={t('asha.selectChild')}
              options={childOptions}
              searchable
            />
            {selectedChild ? (
              <View className="flex-row flex-wrap gap-x-6 gap-y-2 rounded-lg bg-surface-container px-3 py-2">
                <Text className="text-caption text-caption text-on-surface-variant">
                  {`${t('asha.dob')}: ${selectedChild.date_of_birth ?? '—'}`}
                </Text>
                <Text className="text-caption text-caption text-on-surface-variant">
                  {`${t('modules.householdLabel')}: ${selectedChild.household_hhid ?? '—'}`}
                </Text>
              </View>
            ) : null}
            <SelectField
              label={`${t('asha.mother')} *`}
              value={motherId}
              onChange={(next) => setField('motherId', next, setMotherId)}
              errorText={errors.motherId ?? (motherOptions.length === 0 ? t('asha.noPatients') : undefined)}
              placeholder={t('asha.selectMother')}
              options={motherOptions}
              searchable
            />
            <SelectField
              label={t('asha.father')}
              value={fatherId}
              onChange={setFatherId}
              placeholder={t('asha.selectFather')}
              options={fatherOptions}
              searchable
            />
            <TextField
              label={t('asha.birthWeight')}
              value={birthWeight}
              onChangeText={(next) => setField('birthWeight', next.replace(/\D/g, '').slice(0, 5), setBirthWeight)}
              keyboardType="number-pad"
              suffix={t('asha.unitGrams')}
              maxLength={5}
              returnKeyType="next"
            />
            <TextField
              label={`${t('asha.formHeightCm')} (${t('asha.unitCm')})`}
              value={birthLength}
              onChangeText={(next) =>
                setField('birthLength', next.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 5), setBirthLength)
              }
              keyboardType="decimal-pad"
              suffix={t('asha.unitCm')}
              maxLength={5}
              returnKeyType="next"
            />
            <TextField
              label={t('asha.gestationWeeks')}
              value={gestationWeeks}
              onChangeText={(next) => setField('gestationWeeks', next.replace(/\D/g, '').slice(0, 2), setGestationWeeks)}
              keyboardType="number-pad"
              maxLength={2}
              returnKeyType="done"
            />
            <Button
              label={t('asha.saveChild')}
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
        <EmptyState icon="users" title={t('common.noData')} />
      ) : (
        <View className="gap-3">
          {rows.map((row) => (
            <Pressable
              key={row.id ?? row.beneficiary_id}
              accessibilityRole="button"
              onPress={() => router.push(`/patient/${row.beneficiary_id}`)}
            >
              <Card>
                <View className="gap-3 p-4">
                  <View className="flex-1">
                    <Text className="font-headline-md text-headline-md font-semibold text-on-surface" numberOfLines={1}>
                      {row.patient_name ?? '—'}
                    </Text>
                    {row.household_hhid ? (
                      <Text className="text-body-sm text-body-sm text-on-surface-variant">{row.household_hhid}</Text>
                    ) : null}
                  </View>

                  <View className="flex-row flex-wrap gap-x-6 gap-y-2">
                    {row.gestation_weeks != null ? (
                      <Meta label={t('asha.gestationWeeks')} value={`${row.gestation_weeks}`} />
                    ) : null}
                    {row.birth_weight_grams != null ? (
                      <Meta label={t('asha.birthWeight')} value={`${row.birth_weight_grams} ${t('asha.unitGrams')}`} />
                    ) : null}
                    {row.delivery_type ? <Meta label={t('asha.deliveryType')} value={row.delivery_type} /> : null}
                    {row.latest_growth?.weight_kg != null ? (
                      <Meta label={t('asha.weight')} value={`${row.latest_growth.weight_kg} ${t('asha.unitKg')}`} />
                    ) : null}
                    {row.latest_growth?.nutrition_status ? (
                      <Meta label={t('asha.nutritionStatus')} value={row.latest_growth.nutrition_status} />
                    ) : null}
                  </View>

                  {row.vaccination && row.vaccination.total > 0 ? (
                    <View className="flex-row items-center gap-2">
                      <Chip
                        tone={
                          row.vaccination.overdue > 0
                            ? 'error'
                            : row.vaccination.given === row.vaccination.total
                              ? 'success'
                              : 'info'
                        }
                        size="sm"
                      >
                        {`${row.vaccination.given}/${row.vaccination.total} ${t('asha.doses')}`}
                      </Chip>
                      {row.vaccination.overdue > 0 ? (
                        <Text className="text-caption text-error">
                          {t('asha.overdueDoses', { count: row.vaccination.overdue })}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
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
