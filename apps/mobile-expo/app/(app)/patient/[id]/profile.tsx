import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, chipToneColor } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { RiskStrip } from '@/components/ui/RiskStrip';
import { useToast } from '@/components/ui/Toast';
import {
  getPatient,
  getPatientVitals,
  listNcdScreenings,
  type NcdScreening,
  type PatientRow,
  type PatientVitals,
} from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';
import { cx } from '@/cx';

type RecordItem = { key: string; name: string; meta: string; downloadable?: boolean };

type RecordSection = {
  key: string;
  title: string;
  tone: 'primary' | 'secondary' | 'tertiary';
  items: RecordItem[];
};

type VitalTile = {
  key: string;
  label: string;
  value: string;
  icon: IconName;
  tone: 'neutral' | 'error';
};

export default function HealthProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocalization();
  const toast = useToast();

  const [phase, setPhase] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [vitals, setVitals] = useState<PatientVitals | null>(null);
  const [screenings, setScreenings] = useState<NcdScreening[]>([]);

  useEffect(() => {
    if (!id) {
      setPhase('missing');
      return;
    }
    let cancelled = false;
    void (async () => {
      const row = await getPatient(String(id));
      if (cancelled) return;
      if (!row) {
        setPhase('missing');
        return;
      }
      const [latestVitals, ncdRows] = await Promise.all([getPatientVitals(row.id), listNcdScreenings(row.id)]);
      if (cancelled) return;
      setPatient(row);
      setVitals(latestVitals);
      setScreenings(ncdRows);
      setPhase('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (phase === 'missing' || !patient) {
    return (
      <Screen title={t('nav.healthProfile')} back withTabBar={false}>
        <EmptyState
          icon={phase === 'missing' ? 'users' : 'inbox'}
          title={phase === 'missing' ? t('common.noResults') : t('common.loading')}
        />
      </Screen>
    );
  }

  const age =
    patient.age_years !== null
      ? `${patient.age_years} ${t('asha.years')}`
      : patient.age_months !== null
        ? `${patient.age_months} ${t('asha.months')}`
        : '—';

  const meta = [
    age,
    patient.gender ?? t('asha.notRecorded'),
    patient.household_hhid ? t('asha.hhid', { id: patient.household_hhid }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const bloodPressure =
    vitals?.bp_systolic != null && vitals.bp_diastolic != null
      ? `${vitals.bp_systolic}/${vitals.bp_diastolic}`
      : t('asha.notRecorded');

  const vitalsTiles: VitalTile[] = [
    {
      key: 'height',
      label: t('asha.height'),
      value: vitals?.height_cm != null ? `${vitals.height_cm} ${t('asha.unitCm')}` : t('asha.notRecorded'),
      icon: 'activity',
      tone: 'neutral',
    },
    {
      key: 'weight',
      label: t('asha.weight'),
      value: vitals?.weight_kg != null ? `${vitals.weight_kg} ${t('asha.unitKg')}` : t('asha.notRecorded'),
      icon: 'box',
      tone: 'neutral',
    },
    {
      key: 'bloodGroup',
      label: t('asha.bloodGroup'),
      value: vitals?.blood_group ?? t('asha.notRecorded'),
      icon: 'heart',
      tone: 'error',
    },
    { key: 'bp', label: t('asha.latestBp'), value: bloodPressure, icon: 'activity', tone: 'error' },
  ];

  const sections: RecordSection[] = [
    {
      key: 'history',
      title: t('asha.medicalHistory'),
      tone: 'primary',
      items: conditionsFrom(screenings, t).map((condition) => ({
        key: condition.label,
        name: condition.label,
        meta: condition.date
          ? t('asha.diagnosedOn', { date: formatDate(condition.date) })
          : t('asha.notRecorded'),
      })),
    },
    {
      key: 'prescriptions',
      title: t('asha.activePrescriptions'),
      tone: 'secondary',
      items: [],
    },
    {
      key: 'labs',
      title: t('asha.recentLabReports'),
      tone: 'tertiary',
      items: screenings
        .filter((row) => row.blood_sugar_random !== null)
        .slice(0, 3)
        .map((row) => ({
          key: row.id,
          name: t('asha.labBloodSugar'),
          meta: `${row.blood_sugar_random} ${t('asha.unitMgDl')} · ${formatDate(row.screening_date)}`,
          downloadable: true,
        })),
    },
  ];

  return (
    <Screen title={t('nav.healthProfile')} back withTabBar={false}>
      <View className="gap-5">
        <RiskStrip risk={patient.risk} variant="lg">
          <View className="gap-4">
            <View className="flex-row items-center gap-4">
              <View className="h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-container">
                <Text className="font-headline-lg text-headline-lg font-bold text-on-primary-container">
                  {patient.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <View className="min-w-0 flex-1">
                    <Text className="font-headline-lg text-headline-lg text-on-surface">{patient.full_name}</Text>
                  </View>
                  {patient.risk === 'high' ? (
                    <Chip
                      tone="error"
                      icon={<Icon name="alert" size={12} color={chipToneColor.error} />}
                    >
                      {t('asha.highBpMonitoring')}
                    </Chip>
                  ) : null}
                </View>
                <Text className="font-body-md text-body-md text-on-surface-variant">{meta}</Text>
                <Text className="font-caption text-caption text-outline">
                  {t('asha.lastUpdatedOn', { date: formatDate(patient.updated_at) })}
                </Text>
              </View>
            </View>
            <View>
              <Button
                label={t('asha.downloadHealthId')}
                icon="download"
                onPress={() => toast.toast(t('asha.healthIdToast'), 'success')}
              />
            </View>
          </View>
        </RiskStrip>

        <View className="gap-3">
          <View className="flex-row gap-3">
            {vitalsTiles.slice(0, 2).map((tile) => (
              <VitalCard key={tile.key} tile={tile} />
            ))}
          </View>
          <View className="flex-row gap-3">
            {vitalsTiles.slice(2, 4).map((tile) => (
              <VitalCard key={tile.key} tile={tile} />
            ))}
          </View>
        </View>

        <View className="gap-4">
          <View className="border-b border-outline-variant pb-1">
            <Text className="font-headline-md text-headline-md font-semibold text-on-surface">
              {t('asha.recordsSummary')}
            </Text>
          </View>
          {sections.map((section) => (
            <RecordsCard
              key={section.key}
              section={section}
              onViewAll={() => toast.toast(t('asha.viewAllToast'), 'info')}
              onDownload={() => toast.toast(t('asha.downloadToast'), 'success')}
            />
          ))}
        </View>

        <Button
          label={t('asha.backToPatient')}
          icon="chevronLeft"
          variant="ghost"
          shape="pill"
          full
          onPress={() => {
            if (id) router.push(`/patient/${id}`);
          }}
        />
      </View>
    </Screen>
  );
}

function VitalCard({ tile }: { tile: VitalTile }) {
  const error = tile.tone === 'error';
  return (
    <View
      className={cx(
        'flex-1 items-center justify-center gap-1 overflow-hidden rounded-lg border border-outline-variant p-4',
        error ? 'bg-error-container/30' : 'bg-surface-container-low',
      )}
    >
      <Icon name={tile.icon} size={32} color={error ? colors.error : colors.outline} />
      <Text
        className={cx(
          'text-center font-caption text-caption uppercase tracking-wider',
          error ? 'text-error' : 'text-on-surface-variant',
        )}
      >
        {tile.label}
      </Text>
      <Text
        className={cx('text-center font-headline-md text-headline-md', error ? 'text-error' : 'text-on-surface')}
        numberOfLines={1}
      >
        {tile.value}
      </Text>
    </View>
  );
}

function RecordsCard({
  section,
  onViewAll,
  onDownload,
}: {
  section: RecordSection;
  onViewAll: () => void;
  onDownload: () => void;
}) {
  const { t } = useLocalization();
  const tone =
    section.tone === 'secondary' ? 'text-secondary' : section.tone === 'tertiary' ? 'text-tertiary' : 'text-primary';

  return (
    <Card>
      <View className="gap-3 p-5">
        <View className={cx('flex-row items-center gap-2', tone)}>
          <Icon
            name="fileText"
            size={20}
            color={
              section.tone === 'secondary'
                ? colors.secondary
                : section.tone === 'tertiary'
                  ? colors.tertiary
                  : colors.primary
            }
          />
          <Text className="font-label-md text-label-md text-on-surface">{section.title}</Text>
        </View>

        {section.items.length === 0 ? (
          <Text className="font-body-md text-body-md text-on-surface-variant">{t('asha.noRecords')}</Text>
        ) : (
          <View>
            {section.items.map((item, index) => (
              <View
                key={item.key}
                className={cx(
                  'flex-row items-center justify-between gap-2 py-2',
                  index < section.items.length - 1 ? 'border-b border-outline-variant' : null,
                )}
              >
                <View className="min-w-0 flex-1">
                  <Text className="font-body-md text-body-md text-on-surface">{item.name}</Text>
                  <Text className="font-caption text-caption text-on-surface-variant">{item.meta}</Text>
                </View>
                {item.downloadable ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('common.download')}
                    onPress={onDownload}
                    hitSlop={8}
                    className="h-11 w-11 items-center justify-center"
                  >
                    <Icon name="download" size={18} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )}

        <View className="mt-1">
          <Button label={t('asha.viewAll')} variant="ghost" full onPress={onViewAll} />
        </View>
      </View>
    </Card>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function conditionsFrom(
  screenings: NcdScreening[],
  t: ReturnType<typeof useLocalization>['t'],
): Array<{ label: string; date: string | null }> {
  const out = new Map<string, string | null>();
  const add = (label: string, date: string | null) => {
    if (!out.has(label)) out.set(label, date);
  };

  for (const screening of screenings) {
    if (riskFlag(screening.diabetes_risk)) add(t('asha.condDiabetes'), screening.screening_date);
    if (riskFlag(screening.hypertension_risk)) add(t('asha.condHypertension'), screening.screening_date);
    if (screening.bp_systolic !== null && screening.bp_systolic >= 140) {
      add(t('asha.condHighBp'), screening.screening_date);
    }
    if (screening.blood_sugar_random !== null && screening.blood_sugar_random >= 200) {
      add(t('asha.condHighSugar'), screening.screening_date);
    }
  }

  return [...out].map(([label, date]) => ({ label, date }));
}

function riskFlag(value: string | null): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === 'high' || v === 'yes' || v === 'true' || v === 'positive';
}
