import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { DateField, TextField } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';
import { MoreButton, type MoreSection } from '@/nav/MoreSheet';
import { PATIENT_MORE_SECTIONS } from '@/nav/config';
import { colors } from '@/theme';
import { createMyPregnancy, predictMaternalRisk, predictNcdRisk } from '@/patient/api';
import { HealthProfileEditModal } from '@/patient/HealthProfileEditModal';
import { RiskPredictionCard } from '@/patient/RiskPredictionCard';
import { usePatientProfile } from '@/patient/profile';
import type { AIPrediction, MyPatientProfile } from '@/patient/types';
import { shareText } from '@/utils/share';

type Vital = { label: string; value: string; icon: IconName; tone: 'error' | 'default' };

function inputValue(profile: MyPatientProfile | undefined, key: string): unknown {
  return profile?.profileInputs?.[key];
}

function asNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asActivity(value: unknown): 'low' | 'moderate' | 'high' | undefined {
  return value === 'low' || value === 'moderate' || value === 'high' ? value : undefined;
}

/** Builds the ML feature payload from the patient's own stored inputs. */
function buildAssessment(profile: MyPatientProfile | undefined): () => Promise<AIPrediction> {
  return async () => {
    const beneficiaryId = profile?.beneficiaryId;
    if (!profile || !beneficiaryId) throw new Error('No linked health record');
    const vitals = profile.vitals;
    if (profile.isPregnant) {
      return predictMaternalRisk({
        beneficiaryId,
        age: profile.ageYears ?? undefined,
        gravida: asNumber(inputValue(profile, 'gravida')),
        parity: asNumber(inputValue(profile, 'parity')),
        gestationalWeeks: profile.pregnancy?.week ?? undefined,
        ancVisitsAttended: profile.pregnancy?.ancVisits ?? undefined,
        hemoglobin: vitals?.hemoglobin ?? undefined,
        bpSystolic: vitals?.bpSystolic ?? undefined,
        bpDiastolic: vitals?.bpDiastolic ?? undefined,
        weightKg: vitals?.weightKg ?? undefined,
        heightCm: vitals?.heightCm ?? undefined,
        previousCsection: asBool(inputValue(profile, 'previous_csection')),
        previousPph: asBool(inputValue(profile, 'previous_pph')),
        previousPreterm: asBool(inputValue(profile, 'previous_preterm')),
        previousStillbirth: asBool(inputValue(profile, 'previous_stillbirth')),
        multiplePregnancy: asBool(inputValue(profile, 'multiple_pregnancy')),
        hasRiskFactors: profile.pregnancy?.highRisk ?? false,
      });
    }
    const heightCm = vitals?.heightCm ?? undefined;
    const weightKg = vitals?.weightKg ?? undefined;
    const bmi =
      heightCm && weightKg
        ? Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1))
        : undefined;
    return predictNcdRisk({
      beneficiaryId,
      age: profile.ageYears ?? undefined,
      sex: profile.gender ?? undefined,
      heightCm,
      weightKg,
      bmi,
      tobaccoUse: asBool(inputValue(profile, 'tobacco_use')),
      alcoholUse: asBool(inputValue(profile, 'alcohol_use')),
      waistCircumferenceCm: asNumber(inputValue(profile, 'waist_circumference_cm')),
      physicalActivity: asActivity(inputValue(profile, 'physical_activity')),
      familyHistoryDiabetes: asBool(inputValue(profile, 'family_history_diabetes')),
      familyHistoryHypertension: asBool(inputValue(profile, 'family_history_hypertension')),
      knownDiabetes: asBool(inputValue(profile, 'known_diabetes')),
      knownHypertension: asBool(inputValue(profile, 'known_hypertension')),
      bpSystolic: vitals?.bpSystolic ?? undefined,
      bpDiastolic: vitals?.bpDiastolic ?? undefined,
      bloodSugarRandom: asNumber(inputValue(profile, 'blood_sugar_random')),
    });
  };
}

/**
 * My Health Profile, ported from the web's PatientHealthProfilePage: identity
 * card, vitals grid, the AI risk card, pregnancy summary and the personal /
 * conditions columns. The edit button opens the same screening-input form the
 * web modal edits, saved through `PUT /patients/me`.
 */
export default function PatientHealthProfileScreen() {
  const { t } = useLocalization();
  const router = useRouter();
  const profile = usePatientProfile();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [reportingPregnancy, setReportingPregnancy] = useState(false);
  const [lmp, setLmp] = useState('');
  const [gravida, setGravida] = useState('');
  const [parity, setParity] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingPregnancy, setSubmittingPregnancy] = useState(false);
  const [pregnancyError, setPregnancyError] = useState<string | null>(null);

  const moreSections: MoreSection[] = [
    {
      titleKey: 'nav.more',
      items: [
        {
          path: '/edit-profile',
          labelKey: 'patient.editProfile',
          icon: 'edit' as const,
          onPress: () => setEditing(true),
        },
        ...PATIENT_MORE_SECTIONS[0]!.items,
      ],
    },
  ];

  const display = profile.display;
  const raw = profile.raw;

  // Report Pregnancy is offered only to female patients with no ongoing
  // pregnancy — a man or an already-pregnant woman never sees the action.
  const canReportPregnancy =
    (display.gender || '').toLowerCase() === 'female' && !display.pregnant;

  const submitPregnancyReport = async () => {
    if (!lmp) {
      setPregnancyError(t('patient.reportPregnancyLmpRequired'));
      return;
    }
    setSubmittingPregnancy(true);
    setPregnancyError(null);
    try {
      await createMyPregnancy({
        lmp,
        gravida: gravida ? Number(gravida) : undefined,
        parity: parity ? Number(parity) : undefined,
        notes: notes.trim() || undefined,
      });
      toast(t('patient.reportPregnancySuccess'), 'success');
      setReportingPregnancy(false);
      setLmp('');
      setGravida('');
      setParity('');
      setNotes('');
      profile.reload();
    } catch (err) {
      setPregnancyError(err instanceof Error ? err.message : t('common.errorMsg'));
    } finally {
      setSubmittingPregnancy(false);
    }
  };

  const VITALS: Vital[] = [
    { label: t('patient.height'), value: display.height, icon: 'activity', tone: 'default' },
    { label: t('patient.weight'), value: display.weight, icon: 'box', tone: 'default' },
    { label: t('patient.bmi'), value: display.bmi, icon: 'activity', tone: 'default' },
    { label: t('patient.latestBp'), value: display.latestBp, icon: 'activity', tone: 'error' },
    { label: t('patient.pulse'), value: display.pulse, icon: 'heart', tone: 'default' },
    { label: t('patient.temperature'), value: display.temperature, icon: 'activity', tone: 'default' },
    { label: t('patient.spo2'), value: display.spo2, icon: 'activity', tone: 'default' },
    { label: t('patient.haemoglobin'), value: display.haemoglobin, icon: 'heart', tone: 'error' },
    { label: t('patient.bloodSugar'), value: display.bloodSugar, icon: 'activity', tone: 'default' },
    { label: t('patient.waistCircumference'), value: display.waistCircumference, icon: 'activity', tone: 'default' },
  ];

  const personalRows = [
    { label: t('patient.abhaId'), value: display.abhaId },
    { label: t('patient.dob'), value: display.dob },
    { label: t('patient.age'), value: `${display.age} ${t('patient.years')}` },
    { label: t('patient.gender'), value: display.gender },
    { label: t('patient.bloodGroup'), value: display.bloodGroup },
    { label: t('patient.phoneNumber'), value: display.phone },
    { label: t('patient.address'), value: display.address },
    { label: t('patient.assignedPhc'), value: display.phc },
    { label: t('patient.assignedAsha'), value: display.ashaWorker },
  ];

  const pregnancyRows = [
    { label: t('patient.trimester'), value: display.trimester ? String(display.trimester) : '—' },
    { label: t('patient.week'), value: display.week ? String(display.week) : '—' },
    { label: t('patient.lmp'), value: display.lmp },
    { label: t('patient.edd'), value: display.edd },
    { label: t('patient.ancVisits'), value: String(display.ancVisits) },
  ];

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-36"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-headline-lg-bold text-headline-lg text-on-surface">
              {t('patient.healthProfileTitle')}
            </Text>
            <Text className="font-body-md text-body-md text-on-surface-variant">
              {t('patient.healthProfileSubtitle')}
            </Text>
          </View>
          <View className="flex-row shrink-0 items-center gap-2 pt-1">
            <LanguageToggle onSurface />
            <MoreButton sections={moreSections} />
          </View>
        </View>

        {profile.error && !raw ? (
          <EmptyState
            icon="alertCircle"
            title={t('common.errorTitle')}
            description={profile.error}
            action={<Button label={t('common.retry')} onPress={profile.reload} />}
          />
        ) : null}

        <View className="mb-6 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
          <View className="absolute bottom-0 left-0 top-0 w-1 bg-error" />
          <View className="flex-row items-center gap-4 p-5 pl-4">
            <View className="h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-container">
              <Text className="font-headline-lg-bold text-headline-lg text-on-primary-container">
                {(display.name || '?').charAt(0)}
              </Text>
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text
                  className="font-headline-lg text-headline-lg leading-none text-on-surface"
                  numberOfLines={1}
                >
                  {display.name}
                </Text>
                {display.highRisk ? (
                  <View className="flex-row items-center gap-1 rounded-full bg-error-container px-2.5 py-1">
                    <Icon name="alert" size={14} />
                    <Text className="text-caption text-caption text-on-error-container">
                      {t('asha.highRiskLabel')}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-body-md text-body-md text-on-surface-variant">
                {display.age} {t('patient.years')} · {display.gender} · {display.abhaId}
              </Text>
              <Text className="text-caption text-caption text-outline">
                {t('common.village')}: {display.village}
              </Text>
            </View>
          </View>
          <View className="px-5 pb-5">
            <Button
              label={t('patient.downloadHealthId')}
              icon="download"
              shape="pill"
              onPress={() =>
                void shareText(
                  t('patient.downloadHealthId'),
                  [
                    display.name,
                    `${display.age} ${t('patient.years')} · ${display.gender}`,
                    `${t('patient.abhaId')}: ${display.abhaId}`,
                    `${t('common.village')}: ${display.village}`,
                  ].join('\n'),
                )
              }
            />
          </View>
        </View>

        <View className="mb-6 flex-row flex-wrap gap-3">
          {VITALS.map((vital) => (
            <View key={vital.label} className="w-[48%] grow self-stretch">
              <StatCard
                label={vital.label}
                value={vital.value}
                icon={vital.icon}
                tone={vital.tone === 'error' ? 'error' : 'primary'}
              />
            </View>
          ))}
        </View>

        <View className="mb-6">
          <RiskPredictionCard
            beneficiaryId={raw?.beneficiaryId ?? undefined}
            mode={raw?.isPregnant ? 'maternal' : 'ncd'}
            onRun={buildAssessment(raw)}
          />
        </View>

        {display.pregnant ? (
          <View className="mb-6">
            <View className="mb-3 flex-row items-center gap-2">
              <Icon name="heart" size={20} color={colors.primary} />
              <Text className="font-headline-md text-headline-md font-semibold text-on-surface">
                {t('patient.pregnancySummary')}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-3">
              {pregnancyRows.map((row) => (
                <View
                  key={row.label}
                  className="w-[48%] grow rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4"
                >
                  <Text className="text-caption text-caption uppercase text-on-surface-variant">
                    {row.label}
                  </Text>
                  <Text className="mt-1 font-headline-md text-headline-md font-semibold text-on-surface">
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : canReportPregnancy ? (
          <View className="mb-6 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5">
            <View className="flex-row items-center gap-4">
              <View className="h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-container">
                <Icon name="heart" size={28} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-headline-md text-headline-md font-semibold text-on-surface">
                  {t('patient.reportPregnancy')}
                </Text>
                <Text className="mt-0.5 text-body-md text-body-md text-on-surface-variant">
                  {t('patient.reportPregnancySubtitle')}
                </Text>
              </View>
            </View>
            <Button
              label={t('patient.reportPregnancy')}
              icon="heart"
              shape="pill"
              className="mt-4"
              onPress={() => setReportingPregnancy(true)}
              testID="report-pregnancy"
            />
          </View>
        ) : null}

        <View className="mb-6">
          <Text className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">
            {t('patient.personalDetails')}
          </Text>
          <View className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
            {personalRows.map((row, index) => (
              <View
                key={row.label}
                className={cx(
                  'flex-row items-center justify-between gap-4 px-4 py-3',
                  index < personalRows.length - 1 && 'border-b border-outline-variant',
                )}
              >
                <Text className="text-caption text-caption text-on-surface-variant">
                  {row.label}
                </Text>
                <Text
                  className="flex-1 text-right text-body-md text-body-md font-medium text-on-surface"
                  numberOfLines={1}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View>
          <Text className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">
            {t('patient.activeConditions')}
          </Text>
          {display.activeConditions.length > 0 ? (
            <View className="mb-6 gap-3">
              {display.activeConditions.map((condition) => (
                <View
                  key={condition}
                  className="flex-row items-center gap-3 rounded-2xl border border-error/20 bg-error-container/40 p-4"
                >
                  <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-container">
                    <Icon name="alert" size={20} />
                  </View>
                  <Text className="flex-1 text-label-md text-label-md font-semibold text-on-error-container">
                    {condition}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="mb-6 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6">
              <Text className="text-center text-body-md text-body-md text-on-surface-variant">
                {t('patient.noConditions')}
              </Text>
            </View>
          )}

          <Text className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">
            {t('patient.viewRecords')}
          </Text>
          <Pressable accessibilityRole="link" onPress={() => router.push('/records')}>
            <View className="flex-row items-center justify-between rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-container">
                  <Icon name="fileText" size={22} />
                </View>
                <Text className="text-label-md text-label-md font-semibold text-on-surface">
                  {t('patient.recordsTitle')}
                </Text>
              </View>
              <Icon name="chevronRight" size={20} />
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <HealthProfileEditModal
        visible={editing}
        profile={raw}
        onClose={() => setEditing(false)}
        onSaved={profile.reload}
      />

      <Modal
        visible={reportingPregnancy}
        onClose={() => setReportingPregnancy(false)}
        title={t('patient.reportPregnancy')}
      >
        <View className="gap-4 pb-2">
          <Text className="text-body-md text-on-surface-variant">
            {t('patient.reportPregnancySubtitle')}
          </Text>

          <DateField
            label={t('patient.lmp')}
            value={lmp}
            onChange={setLmp}
            placeholder={t('patient.lmp')}
            maxIso={new Date().toISOString().slice(0, 10)}
            errorText={pregnancyError && !lmp ? t('patient.reportPregnancyLmpRequired') : undefined}
          />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                label={t('patient.gravida')}
                value={gravida}
                onChangeText={setGravida}
                keyboardType="number-pad"
                placeholder="—"
              />
            </View>
            <View className="flex-1">
              <TextField
                label={t('patient.parity')}
                value={parity}
                onChangeText={setParity}
                keyboardType="number-pad"
                placeholder="—"
              />
            </View>
          </View>

          <TextField
            label={t('patient.notes')}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('patient.reportPregnancyNotesPlaceholder')}
            multiline
            numberOfLines={2}
          />

          {pregnancyError ? (
            <Text className="text-caption text-error">{pregnancyError}</Text>
          ) : null}

          <Button
            label={t('patient.reportPregnancy')}
            icon="heart"
            shape="pill"
            full
            loading={submittingPregnancy}
            onPress={() => void submitPregnancyReport()}
            testID="submit-pregnancy-report"
          />
        </View>
      </Modal>
    </View>
  );
}
