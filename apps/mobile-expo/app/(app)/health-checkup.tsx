import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Card, Pill } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StatCard } from '@/components/ui/StatCard';
import { cx } from '@/cx';
import { checkupRiskLevel, listHealthCheckups, type HealthCheckup } from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';
import { colors, type Tone } from '@/theme';

type RiskFilter = 'all' | 'high' | 'medium' | 'low';

const FILTERS: RiskFilter[] = ['all', 'high', 'medium', 'low'];

const RISK: Record<'high' | 'medium' | 'low', { labelKey: string; tone: Tone; icon: IconName }> = {
  high: { labelKey: 'modules.riskHigh', tone: 'error', icon: 'alert' },
  medium: { labelKey: 'modules.riskMedium', tone: 'tertiary', icon: 'activity' },
  low: { labelKey: 'modules.riskLow', tone: 'secondary', icon: 'checkCircle' },
};

const RISK_CLS: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-error-container',
  medium: 'bg-surface-container-highest',
  low: 'bg-secondary-container',
};

/**
 * Health Check-up, from the More menu.
 *
 * Reads the `ncd_screenings` table the app already syncs. The four risk
 * columns are collapsed into one band by checkupRiskLevel, because a field
 * worker triages on "does this person need a referral today", not on which of
 * the four conditions flagged them.
 */
export default function HealthCheckupScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const [rows, setRows] = useState<HealthCheckup[]>([]);
  const [filter, setFilter] = useState<RiskFilter>('all');
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setRows((await listHealthCheckups()) as HealthCheckup[]);
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const next: Record<RiskFilter, number> = { all: rows.length, high: 0, medium: 0, low: 0 };
    for (const row of rows) next[checkupRiskLevel(row)] += 1;
    return next;
  }, [rows]);

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((row) => checkupRiskLevel(row) === filter)),
    [rows, filter],
  );

  const referred = useMemo(() => rows.reduce((n, row) => (row.referral_made === 1 ? n + 1 : n), 0), [rows]);

  return (
    <Screen title={t('asha.healthCheckupTitle')} subtitle={t('asha.healthCheckupSubtitle')} back withTabBar={false}>
      {status === 'failed' ? (
        <EmptyState
          icon="alertCircle"
          title={t('common.errorTitle')}
          description={t('common.errorMsg')}
          action={<RetryButton label={t('common.retry')} onPress={() => void load()} />}
        />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-3">
            {/* w-[46%] + grow pins the tiles at two per row down to 320dp and
                still fills the line, instead of a fourth tile overflowing. */}
            <View className="w-[46%] grow">
              <StatCard label={t('kpis.ncdScreened')} value={rows.length} icon="users" />
            </View>
            <View className="w-[46%] grow">
              <StatCard label={t('modules.riskHigh')} value={counts.high} icon={RISK.high.icon} tone={RISK.high.tone} />
            </View>
            <View className="w-[46%] grow">
              <StatCard
                label={t('modules.riskMedium')}
                value={counts.medium}
                icon={RISK.medium.icon}
                tone={RISK.medium.tone}
              />
            </View>
            <View className="w-[46%] grow">
              <StatCard label={t('modules.checkupReferral')} value={referred} icon="fileText" tone="secondary" />
            </View>
          </View>

          <View className="mt-4 flex-row flex-wrap gap-2">
            {FILTERS.map((key) => (
              <Pill
                key={key}
                label={key === 'all' ? t('asha.filterAll') : t(RISK[key].labelKey)}
                count={counts[key]}
                active={filter === key}
                onPress={() => setFilter(key)}
              />
            ))}
          </View>

          <View className="mt-4">
            {rows.length === 0 ? (
              status === 'loading' ? (
                <EmptyState icon="inbox" title={t('common.noData')} />
              ) : (
                <EmptyState
                  icon="activity"
                  title={t('modules.checkupEmpty')}
                  description={t('modules.checkupEmptyHint')}
                />
              )
            ) : visible.length === 0 ? (
              <EmptyState icon="search" title={t('common.noResults')} />
            ) : (
              <View className="gap-3">
                {visible.map((row) => (
                  <CheckupCard key={row.id} row={row} onPress={() => router.push(`/patient/${row.beneficiary_id}`)} />
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

function CheckupCard({ row, onPress }: { row: HealthCheckup; onPress: () => void }) {
  const { t } = useLocalization();
  const level = checkupRiskLevel(row);
  const risk = RISK[level];

  const age =
    row.age_years != null
      ? `${row.age_years} ${t('asha.ageYearsUnit')}`
      : row.age_months != null
        ? `${row.age_months} ${t('asha.ageMonthsUnit')}`
        : null;
  // One half is enough to make the row worth printing, so the pair is hidden
  // only when the screening recorded neither.
  const bp =
    row.bp_systolic != null || row.bp_diastolic != null
      ? `${row.bp_systolic ?? '—'}/${row.bp_diastolic ?? '—'}`
      : null;
  const referred = row.referral_made === 1;

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card rail={referred ? colors.secondary : undefined}>
        <View className={cx('gap-3', referred ? 'p-4 pl-6' : 'p-4')}>
          <View className="flex-row flex-wrap items-start justify-between gap-2">
            <Text
              className="min-w-0 flex-1 font-headline-md text-headline-md font-semibold text-on-surface"
              numberOfLines={1}
            >
              {row.patient_name ?? '—'}
            </Text>
            <View className={cx('flex-row items-center gap-1.5 rounded-full px-2.5 py-1', RISK_CLS[level])}>
              <Icon name={risk.icon} size={12} />
              <Text className="font-caption text-caption font-semibold text-on-surface-variant">
                {t(risk.labelKey)}
              </Text>
            </View>
          </View>

          <Text numberOfLines={1} className="font-caption text-caption text-on-surface-variant">
            {[age, row.screening_date, row.household_hhid ? t('patient.hhid', { id: row.household_hhid }) : null]
              .filter((part): part is string => Boolean(part))
              .join(' • ')}
          </Text>

          <View className="flex-row flex-wrap gap-x-6 gap-y-2">
            {bp ? <Meta label={t('modules.checkupBp')} value={bp} /> : null}
            {row.blood_sugar_random != null ? (
              <Meta label={t('modules.checkupSugar')} value={`${row.blood_sugar_random} mg/dl`} />
            ) : null}
            {row.waist_circumference_cm != null ? (
              <Meta label={t('modules.checkupWaist')} value={`${row.waist_circumference_cm}`} />
            ) : null}
          </View>

          <View className="flex-row flex-wrap gap-2">
            {row.tobacco_use != null ? <Flag label={t('modules.checkupTobacco')} on={row.tobacco_use === 1} /> : null}
            {row.alcohol_use != null ? <Flag label={t('modules.checkupAlcohol')} on={row.alcohol_use === 1} /> : null}
            {row.physical_activity != null ? (
              <Flag label={t('modules.checkupActivity')} on={row.physical_activity === 1} />
            ) : null}
            {referred ? (
              <View className="flex-row items-center gap-1.5 rounded-full bg-secondary-container px-2.5 py-1">
                <Icon name="fileText" size={12} color={colors.onSecondaryContainer} />
                <Text numberOfLines={1} className="shrink font-caption text-caption font-semibold text-on-secondary-container">
                  {[t('modules.checkupReferral'), row.referral_type].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function Flag({ label, on }: { label: string; on: boolean }) {
  const { t } = useLocalization();
  return (
    <View className={cx('flex-row items-center gap-1.5 rounded-full px-2.5 py-1', on ? 'bg-error-container' : 'bg-surface-container-high')}>
      <Icon name={on ? 'alert' : 'check'} size={12} />
      <Text numberOfLines={1} className="shrink font-caption text-caption text-on-surface-variant">
        {`${label} · ${on ? t('common.yes') : t('common.no')}`}
      </Text>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="min-w-0">
      <Text className="font-caption text-caption text-on-surface-variant">{label}</Text>
      <Text className="font-body-md text-body-md font-semibold text-on-surface">{value}</Text>
    </View>
  );
}

function RetryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="w-full max-w-xs items-center rounded-lg bg-primary px-5 py-3"
    >
      <View className="flex-row items-center justify-center gap-2">
        <Icon name="refresh" size={18} color={colors.onPrimary} />
        <Text className="font-label-md text-label-md text-on-primary">{label}</Text>
      </View>
    </Pressable>
  );
}
