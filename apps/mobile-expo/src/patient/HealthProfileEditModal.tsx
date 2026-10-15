import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SelectField, TextField } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';
import { invalidateProfileCache, updateMyProfile } from '@/patient/api';
import type { MyPatientProfile, PatientProfileUpdatePayload } from '@/patient/types';

type NumericKey =
  | 'heightCm'
  | 'weightKg'
  | 'bpSystolic'
  | 'bpDiastolic'
  | 'bloodSugarRandom'
  | 'waistCircumferenceCm'
  | 'hemoglobin';

type BooleanKey =
  | 'tobaccoUse'
  | 'alcoholUse'
  | 'familyHistoryDiabetes'
  | 'familyHistoryHypertension'
  | 'knownDiabetes'
  | 'knownHypertension';

const NUMERIC_FIELDS: NumericKey[] = [
  'heightCm',
  'weightKg',
  'bpSystolic',
  'bpDiastolic',
  'hemoglobin',
  'bloodSugarRandom',
  'waistCircumferenceCm',
];

const BOOLEAN_FIELDS: BooleanKey[] = [
  'tobaccoUse',
  'alcoholUse',
  'knownDiabetes',
  'knownHypertension',
  'familyHistoryDiabetes',
  'familyHistoryHypertension',
];

/** camel payload key → the snake_case key stored in `profile_inputs`. */
const INPUT_KEY: Record<NumericKey | BooleanKey | 'physicalActivity', string> = {
  heightCm: 'height_cm',
  weightKg: 'weight_kg',
  bpSystolic: 'bp_systolic',
  bpDiastolic: 'bp_diastolic',
  bloodSugarRandom: 'blood_sugar_random',
  waistCircumferenceCm: 'waist_circumference_cm',
  hemoglobin: 'hemoglobin',
  tobaccoUse: 'tobacco_use',
  alcoholUse: 'alcohol_use',
  physicalActivity: 'physical_activity',
  familyHistoryDiabetes: 'family_history_diabetes',
  familyHistoryHypertension: 'family_history_hypertension',
  knownDiabetes: 'known_diabetes',
  knownHypertension: 'known_hypertension',
};

const LABEL_KEY: Record<BooleanKey, string> = {
  tobaccoUse: 'profileEdit.tobacco',
  alcoholUse: 'profileEdit.alcohol',
  knownDiabetes: 'profileEdit.knownDiabetes',
  knownHypertension: 'profileEdit.knownHypertension',
  familyHistoryDiabetes: 'profileEdit.familyDiabetes',
  familyHistoryHypertension: 'profileEdit.familyHypertension',
};

type FormState = Record<NumericKey, string> &
  Record<BooleanKey, boolean | ''> & { physicalActivity: string };

const VITAL_KEYS = ['heightCm', 'weightKg', 'bpSystolic', 'bpDiastolic', 'hemoglobin'] as const;
type VitalKey = (typeof VITAL_KEYS)[number];

function readInitial(profile: MyPatientProfile | undefined): FormState {
  const inputs = profile?.profileInputs ?? {};
  const vitals = profile?.vitals;
  /** `vitals` only carries these five; the rest live in `profile_inputs` only. */
  const num = (key: NumericKey): string => {
    const fromInputs = inputs[INPUT_KEY[key]];
    const fromVitals = VITAL_KEYS.includes(key as VitalKey) ? vitals?.[key as VitalKey] : undefined;
    const resolved = fromInputs ?? fromVitals;
    return resolved == null ? '' : String(resolved);
  };
  const bool = (key: BooleanKey): boolean | '' => {
    const value = inputs[INPUT_KEY[key]];
    return typeof value === 'boolean' ? value : '';
  };
  return {
    heightCm: num('heightCm'),
    weightKg: num('weightKg'),
    bpSystolic: num('bpSystolic'),
    bpDiastolic: num('bpDiastolic'),
    bloodSugarRandom: num('bloodSugarRandom'),
    waistCircumferenceCm: num('waistCircumferenceCm'),
    hemoglobin: num('hemoglobin'),
    tobaccoUse: bool('tobaccoUse'),
    alcoholUse: bool('alcoholUse'),
    knownDiabetes: bool('knownDiabetes'),
    knownHypertension: bool('knownHypertension'),
    familyHistoryDiabetes: bool('familyHistoryDiabetes'),
    familyHistoryHypertension: bool('familyHistoryHypertension'),
    physicalActivity:
      typeof inputs.physical_activity === 'string' ? (inputs.physical_activity as string) : '',
  };
}

/** Only the fields the user actually changed — everything else stays put. */
function diff(initial: FormState, next: FormState): PatientProfileUpdatePayload {
  const payload: PatientProfileUpdatePayload = {};
  for (const key of NUMERIC_FIELDS) {
    const before = initial[key];
    const after = next[key].trim();
    if (after === before.trim()) continue;
    if (after === '') continue;
    const parsed = Number(after);
    if (Number.isNaN(parsed)) continue;
    (payload as Record<string, unknown>)[key] = parsed;
  }
  for (const key of BOOLEAN_FIELDS) {
    if (initial[key] === next[key]) continue;
    if (next[key] === '') continue;
    (payload as Record<string, unknown>)[key] = next[key];
  }
  if (initial.physicalActivity !== next.physicalActivity && next.physicalActivity) {
    payload.physicalActivity = next.physicalActivity as 'low' | 'moderate' | 'high';
  }
  return payload;
}

/**
 * Editable screening inputs for the signed-in patient, saved through
 * `PUT /patients/me`. Empty numeric fields mean "leave unchanged", never
 * "clear" — the endpoint merges only the keys it is given. Port of the web's
 * HealthProfileEditModal: same fields, same diff-on-save contract, bottom
 * sheet instead of a centered dialog.
 */
export function HealthProfileEditModal({
  visible,
  profile,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profile: MyPatientProfile | undefined;
  onClose: () => void;
  /** Called after a successful save so the screen can refetch the profile. */
  onSaved?: () => void;
}) {
  const { t } = useLocalization();
  const { toast } = useToast();
  const [initial, setInitial] = useState<FormState>(() => readInitial(profile));
  const [form, setForm] = useState<FormState>(() => readInitial(profile));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const snapshot = readInitial(profile);
    setInitial(snapshot);
    setForm(snapshot);
  }, [visible, profile]);

  if (!visible) return null;

  const setNum = (key: NumericKey, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const setBool = (key: BooleanKey, value: boolean) =>
    setForm((prev) => ({ ...prev, [key]: prev[key] === value ? '' : value }));

  const save = async () => {
    const payload = diff(initial, form);
    if (Object.keys(payload).length === 0) {
      toast(t('profileEdit.nothingToSave'), 'info');
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile(payload);
      invalidateProfileCache();
      toast(t('profileEdit.saved'), 'success');
      onSaved?.();
      onClose();
    } catch (err) {
      toast(`${t('profileEdit.saveFailed')}: ${err instanceof Error ? err.message : ''}`.trim(), 'error');
    } finally {
      setSaving(false);
    }
  };

  const numeric = (key: NumericKey, label: string) => (
    <View key={key} className="w-[48%] grow">
      <TextField
        label={label}
        value={form[key]}
        onChangeText={(value) => setNum(key, value)}
        keyboardType="decimal-pad"
        returnKeyType="done"
      />
    </View>
  );

  const toggle = (key: BooleanKey) => {
    const label = t(LABEL_KEY[key]);
    const state = form[key];
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setBool(key, true)}
        className={cx(
          'w-full flex-row items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
          state === true ? 'border-error bg-error-container/40' : 'border-outline bg-surface',
        )}
      >
        <Text className="flex-1 text-body-md text-on-surface">{label}</Text>
        <Text
          className={cx(
            'rounded-full px-3 py-1 text-caption',
            state === true
              ? 'bg-error-container text-on-error-container'
              : 'bg-surface-container text-on-surface-variant',
          )}
        >
          {state === true ? t('common.yes') : state === false ? t('common.no') : '—'}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal visible onClose={onClose} title={t('profileEdit.title')}>
      <Text className="mb-3 text-caption text-on-surface-variant">{t('profileEdit.subtitle')}</Text>
      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        <View className="gap-4">
          <View>
            <Text className="mb-2 text-label-md text-label-md font-semibold text-on-surface">
              {t('profileEdit.vitals')}
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {numeric('heightCm', t('profileEdit.height'))}
              {numeric('weightKg', t('profileEdit.weight'))}
              {numeric('waistCircumferenceCm', t('profileEdit.waist'))}
              {numeric('bpSystolic', t('profileEdit.systolic'))}
              {numeric('bpDiastolic', t('profileEdit.diastolic'))}
              {numeric('hemoglobin', t('profileEdit.haemoglobin'))}
              {numeric('bloodSugarRandom', t('profileEdit.bloodSugar'))}
            </View>
          </View>

          <View>
            <Text className="mb-2 text-label-md text-label-md font-semibold text-on-surface">
              {t('profileEdit.lifestyle')}
            </Text>
            <View className="gap-2">{BOOLEAN_FIELDS.map(toggle)}</View>
            <View className="mt-3">
              <SelectField
                label={t('profileEdit.activity')}
                value={form.physicalActivity}
                placeholder="—"
                options={[
                  { label: t('profileEdit.activityLow'), value: 'low' },
                  { label: t('profileEdit.activityModerate'), value: 'moderate' },
                  { label: t('profileEdit.activityHigh'), value: 'high' },
                ]}
                onChange={(value) => setForm((prev) => ({ ...prev, physicalActivity: value }))}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="mt-4 flex-row justify-end gap-3">
        <Button label={t('common.cancel')} variant="secondary" shape="pill" onPress={onClose} />
        <Button
          label={saving ? t('common.loading') : t('common.save')}
          shape="pill"
          loading={saving}
          onPress={() => void save()}
          testID="profile-save"
        />
      </View>
    </Modal>
  );
}
