import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SelectField } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import {
  getPatient,
  listChildrenForBeneficiary,
  listChildrenInHousehold,
  listImmunizationDetails,
  markImmunizationGiven,
  type ChildOption,
  type ImmunizationDetail,
  type PatientRow,
} from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';
import { isCurrentlyOnline, scheduleSync } from '@/sync/network';
import { colors } from '@/theme';
import { cx } from '@/cx';

export type DoseStatus = 'given' | 'due' | 'upcoming' | 'overdue';

const NODE_CLS: Record<DoseStatus, string> = {
  given: 'bg-secondary',
  due: 'bg-primary',
  upcoming: 'bg-outline',
  overdue: 'bg-error',
};

const NODE_ICON: Record<DoseStatus, IconName> = {
  given: 'check',
  due: 'calendar',
  upcoming: 'calendar',
  overdue: 'alert',
};

const NODE_COLOR: Record<DoseStatus, string> = {
  given: colors.onSecondary,
  due: colors.onPrimary,
  upcoming: colors.onPrimary,
  overdue: colors.onError,
};

const CARD_CLS: Record<DoseStatus, string> = {
  given: 'border-outline-variant bg-surface',
  due: 'border-primary-fixed-dim bg-primary-fixed',
  upcoming: 'border-outline-variant bg-surface',
  overdue: 'border-error bg-error-container',
};

export function deriveDoseStatus(
  row: { status: string | null; given_date: string | null; due_date: string | null },
  today: Date = new Date(),
): DoseStatus {
  const status = (row.status ?? '').trim().toLowerCase();
  if (status === 'given' || row.given_date) return 'given';
  if (status === 'overdue') return 'overdue';
  if (status === 'skipped') return 'upcoming';
  return dueDateState(row.due_date, today);
}

function dueDateState(dueDate: string | null, today: Date): DoseStatus {
  if (!dueDate) return 'due';
  const [year, month, day] = dueDate.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return 'due';
  const due = year * 10000 + month * 100 + day;
  const now = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  if (due < now) return 'overdue';
  if (due > now) return 'upcoming';
  return 'due';
}

function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
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

export default function ImmunizationScheduleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocalization();
  const toast = useToast();

  const [phase, setPhase] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [activeChildId, setActiveChildId] = useState('');
  const [doses, setDoses] = useState<ImmunizationDetail[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

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
      const siblings = row.household_id
        ? await listChildrenInHousehold(row.household_id)
        : await listChildrenForBeneficiary(row.id);
      if (cancelled) return;
      const active =
        siblings.find((child) => child.beneficiary_id === row.id && child.dose_count > 0) ??
        siblings.find((child) => child.dose_count > 0) ??
        siblings.find((child) => child.beneficiary_id === row.id) ??
        siblings[0];
      setPatient(row);
      setChildren(siblings);
      setActiveChildId(active?.id ?? '');
      setPhase('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (phase !== 'ready') return;
    if (!activeChildId) {
      setDoses([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const rows = await listImmunizationDetails(activeChildId);
      if (cancelled) return;
      setDoses(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, activeChildId]);

  const markGiven = useCallback(
    async (row: ImmunizationDetail) => {
      if (savingId) return;
      setSavingId(row.id);
      try {
        const givenDate = todayISO();
        await markImmunizationGiven(row, givenDate);
        setDoses((prev) =>
          prev
            ? prev.map((dose) => (dose.id === row.id ? { ...dose, status: 'given', given_date: givenDate } : dose))
            : prev,
        );
        toast.toast(t('asha.doseMarkedToast'), 'success');
        if (isCurrentlyOnline()) void scheduleSync();
      } finally {
        setSavingId(null);
      }
    },
    [savingId, t, toast],
  );

  if (phase === 'missing' || !patient) {
    return (
      <Screen title={t('nav.immunization')} back withTabBar={false}>
        <EmptyState
          icon={phase === 'missing' ? 'users' : 'inbox'}
          title={phase === 'missing' ? t('common.noResults') : t('common.loading')}
        />
      </Screen>
    );
  }

  const currentDose = doses?.find((row) => deriveDoseStatus(row) === 'due') ?? null;

  const scheduleBody = (() => {
    if (phase !== 'ready' || doses === null) {
      return <EmptyState icon="inbox" title={t('common.loading')} />;
    }
    if (children.length === 0) {
      return <EmptyState icon="users" title={t('asha.noChildRegistered')} />;
    }
    if (doses.length === 0) {
      return (
        <EmptyState icon="calendar" title={t('asha.immunizationEmpty')} description={t('asha.immunizationEmptyHint')} />
      );
    }
    return (
      <View className="relative gap-6">
        <View className="absolute bottom-0 left-0 top-0 w-0.5 bg-outline-variant" />
        {doses.map((row) => (
          <DoseRow key={row.id} row={row} saving={savingId === row.id} onMark={markGiven} />
        ))}
      </View>
    );
  })();

  return (
    <Screen title={t('nav.immunization')} back withTabBar={false}>
      <View className="gap-5">
        <View className="gap-1">
          <Text className="font-display-lg text-display-lg font-bold text-primary">
            {t('asha.vaccinationTracking')}
          </Text>
          <Text className="font-body-md text-body-md text-on-surface-variant">
            {t('asha.patientLabel', { name: patient.full_name, id: patient.abha_id ?? '—' })}
          </Text>
        </View>

        <Card>
          <View className="gap-5 p-5">
            <View className="flex-row items-center justify-between gap-2 border-b border-outline-variant pb-2">
              <Text
                className="min-w-0 flex-1 font-headline-md text-headline-md font-semibold text-on-surface"
                numberOfLines={1}
              >
                {t('asha.immunizationSchedule')}
              </Text>
              <Chip tone="success" size="md">
                {t('asha.onTrack')}
              </Chip>
            </View>

            {children.length > 1 ? (
              <SelectField
                label={t('asha.selectChild')}
                value={activeChildId}
                placeholder={t('asha.selectChild')}
                options={children.map((child) => ({
                  label: child.child_name ?? child.birth_registration_no ?? child.id.slice(0, 8),
                  value: child.id,
                }))}
                onChange={setActiveChildId}
              />
            ) : null}

            {scheduleBody}
          </View>
        </Card>

        <View className="gap-4">
          <Card>
            <View className="items-center gap-4 p-5">
              <Icon name="checkCircle" size={48} color={colors.tertiary} />
              <View className="items-center gap-1">
                <Text className="font-headline-md text-headline-md font-semibold text-on-surface">
                  {t('asha.officialRecords')}
                </Text>
                <Text className="text-center font-body-md text-body-md text-on-surface-variant">
                  {t('asha.certificateHint')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => toast.toast(t('asha.certificateToast'), 'success')}
                className="h-touch-target w-full flex-row items-center justify-center gap-1 rounded-full bg-outline-variant px-5 active:opacity-90"
              >
                <Icon name="download" size={18} color={colors.onSurface} />
                <Text className="font-label-md text-label-md font-semibold text-on-surface">
                  {t('asha.viewCertificate')}
                </Text>
              </Pressable>
            </View>
          </Card>

          <View className="rounded-xl border-l-4 border-primary-container bg-surface-container p-4">
            <View className="mb-1 flex-row items-start gap-2">
              <View className="mt-0.5">
                <Icon name="alert" size={18} color={colors.primary} />
              </View>
              <Text className="font-label-md text-label-md font-semibold text-on-surface">
                {t('asha.nextDoseInfo')}
              </Text>
            </View>
            <Text className="pl-7 font-body-md text-body-md text-on-surface-variant">{t('asha.nextDoseHint')}</Text>
          </View>

          {currentDose ? (
            <Button
              label={t('asha.markCompleted')}
              icon="checkCircle"
              variant="secondary"
              shape="pill"
              full
              loading={savingId === currentDose.id}
              onPress={() => void markGiven(currentDose)}
            />
          ) : null}

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
      </View>
    </Screen>
  );
}

function DoseRow({
  row,
  saving,
  onMark,
}: {
  row: ImmunizationDetail;
  saving: boolean;
  onMark: (row: ImmunizationDetail) => void;
}) {
  const { t } = useLocalization();
  const status = deriveDoseStatus(row);
  const name = row.vaccine_name || row.vaccine_code || '—';
  const code = row.vaccine_code ?? row.vaccine_name ?? '—';
  const meta = row.dose_number !== null ? t('asha.doseMeta', { n: row.dose_number, code }) : code;
  const date = formatDate(status === 'given' ? row.given_date : row.due_date);

  return (
    <View className="relative pl-6">
      <TimelineNode status={status} />
      <View className={cx('rounded-lg border p-4', CARD_CLS[status])}>
        <View className="mb-2 flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <Text className="font-label-md text-label-md text-on-surface">{name}</Text>
            <Text className="mt-1 font-caption text-caption text-on-surface-variant">{meta}</Text>
          </View>
          {status === 'overdue' ? (
            <Text className="font-caption text-caption font-bold text-error">{t('asha.overdue')}</Text>
          ) : status === 'due' ? (
            <Text className="font-caption text-caption font-bold text-primary">{t('asha.dueLabel', { date })}</Text>
          ) : (
            <Text className="font-caption text-caption text-outline">{date}</Text>
          )}
        </View>

        {status === 'given' ? (
          <View className="flex-row items-center gap-1">
            <Icon name="checkCircle" size={16} color={colors.secondary} />
            <Text className="font-label-md text-label-md text-secondary">{t('asha.administered')}</Text>
          </View>
        ) : null}

        {status === 'due' ? (
          <View className="mt-2">
            <Button label={t('asha.markCompleted')} icon="edit" full loading={saving} onPress={() => onMark(row)} />
          </View>
        ) : null}

        {status === 'upcoming' ? (
          <View className="flex-row items-center gap-1">
            <Icon name="calendar" size={16} color={colors.onSurfaceVariant} />
            <Text className="font-label-md text-label-md text-on-surface-variant">{t('asha.upcoming')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function TimelineNode({ status }: { status: DoseStatus }) {
  const pulse = usePulse(status === 'due');

  return (
    <View className="absolute -left-[16px] top-1 h-8 w-8">
      <Animated.View
        className={cx(
          'h-8 w-8 items-center justify-center rounded-full border-4 border-surface-container-lowest',
          NODE_CLS[status],
        )}
        style={status === 'due' ? { opacity: pulse } : undefined}
      >
        <Icon name={NODE_ICON[status]} size={18} color={NODE_COLOR[status]} />
      </Animated.View>
    </View>
  );
}

function usePulse(active: boolean): Animated.Value {
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  return pulse;
}
