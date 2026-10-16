import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { PageHeader, Pill } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { Icon, type IconName } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/Field';
import { listPatients, type PatientRow, type RiskLevel } from '@/db/clinical';
import { subscribeSync } from '@/sync/network';
import { useLocalization } from '@/i18n/useLocalization';
import { LanguageToggle } from '@/components/LanguageToggle';
import { MoreButton } from '@/nav/MoreSheet';
import { cx } from '@/cx';
import { shadow } from '@/theme';

/**
 * Port of PatientDashboardAshaSathi.tsx.
 *
 * The web filters its mock array in memory. Here the search term and risk band
 * are pushed into the SQLite query (listPatients) so the list stays correct once
 * a pull brings down thousands of beneficiaries rather than the mock's handful.
 */

type RiskFilter = RiskLevel | 'all';

const RISK_CHIP: Record<RiskLevel, { labelKey: string; cls: string; icon: IconName }> = {
  low: { labelKey: 'asha.riskLowLabel', cls: 'bg-secondary-container', icon: 'checkCircle' },
  medium: { labelKey: 'asha.riskMediumLabel', cls: 'bg-amber-light', icon: 'alert' },
  high: { labelKey: 'asha.riskHighLabel', cls: 'bg-error-container', icon: 'alert' },
};

const FILTERS: RiskFilter[] = ['all', 'high', 'medium', 'low'];

export default function PatientsScreen() {
  const { t } = useLocalization();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [risk, setRisk] = useState<RiskFilter>('all');
  const [all, setAll] = useState<PatientRow[]>([]);
  const [filtered, setFiltered] = useState<PatientRow[]>([]);

  // Latest search/risk, read when focus fires. The focus load must not depend
  // on them: a dependency change re-runs it on every keystroke, which would
  // query immediately and defeat the debounce below.
  const criteria = useRef({ query, risk });
  useEffect(() => {
    criteria.current = { query, risk };
  });

  // Keep the full set for the filter counts; filter the visible rows in the
  // query. Reloads on focus as well as mount: the tab navigator keeps this
  // screen mounted, so a patient registered offline would otherwise stay
  // invisible until the next sync event.
  useFocusEffect(
    useCallback(() => {
      const { query: search, risk: band } = criteria.current;
      void (async () => {
        setAll(await listPatients({}));
        setFiltered(await listPatients({ search, risk: band }));
      })();
    }, []),
  );

  // A sync landing while open (post-login pull, Sync Now) changes the cohort.
  useEffect(() => subscribeSync((result) => {
    if (!result) return;
    void (async () => {
      setAll(await listPatients({}));
      setFiltered(await listPatients({ search: query, risk }));
    })();
  }), [query, risk]);

  // The first load is not debounced: delaying it would flash the "no results"
  // empty state for the debounce window on every visit, which reads as "this
  // ASHA has no patients" until the rows arrive.
  const isFirstRun = useRef(true);
  useEffect(() => {
    const load = () => {
      void (async () => {
        setFiltered(await listPatients({ search: query, risk }));
      })();
    };
    if (isFirstRun.current) {
      isFirstRun.current = false;
      load();
      return;
    }
    const handle = setTimeout(load, 200);
    return () => clearTimeout(handle);
  }, [query, risk]);

  const counts = useMemo(
    () => ({
      all: all.length,
      high: all.filter((p) => p.risk === 'high').length,
      medium: all.filter((p) => p.risk === 'medium').length,
      low: all.filter((p) => p.risk === 'low').length,
    }),
    [all],
  );

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-36"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader
          title={t('asha.patientsTitle')}
          actions={
            <>
              <LanguageToggle onSurface />
              <MoreButton />
            </>
          }
        />

        <View className="gap-3">
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder={t('asha.patientSearchPlaceholder')}
            prefixIcon="search"
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          <View className="flex-row flex-wrap gap-2">
            {FILTERS.map((key) => (
              <Pill
                key={key}
                label={key === 'all' ? t('asha.filterAll') : t(RISK_CHIP[key].labelKey)}
                count={counts[key]}
                active={risk === key}
                onPress={() => setRisk(key)}
              />
            ))}
          </View>
        </View>

        <View className="mt-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon="users"
              title={all.length === 0 ? t('asha.noPatients') : t('common.noResults')}
              description={all.length === 0 ? t('asha.noPatientsHint') : undefined}
              actionLabel={all.length === 0 ? t('asha.registerPatient') : undefined}
              onActionPress={all.length === 0 ? () => router.push('/register') : undefined}
            />
          ) : (
            <View className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest" style={shadow.card}>
              {filtered.map((patient, index) => {
                const chip = RISK_CHIP[patient.risk];
                return (
                  <Pressable
                    key={patient.id}
                    accessibilityRole="link"
                    accessibilityLabel={patient.full_name}
                    onPress={() => router.push(`/patient/${patient.id}`)}
                    className={cx(
                      'flex-row items-center gap-3 p-4',
                      index < filtered.length - 1 && 'border-b border-outline-variant/40',
                    )}
                  >
                    <View className="h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-container">
                      <Text className="font-headline-md text-headline-md font-bold text-on-primary-container">
                        {patient.full_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View className="flex-1">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="font-label-md text-label-md font-semibold text-on-surface">
                          {patient.full_name}
                        </Text>
                        {patient.risk_reason ? (
                          <View className="rounded-full bg-secondary-container px-2 py-0.5">
                            <Text numberOfLines={1} className="font-caption text-caption text-on-secondary-container">
                              {patient.risk_reason}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text numberOfLines={1} className="font-caption text-caption text-on-surface-variant">
                        {[patient.beneficiary_id, ageLabel(patient, t('asha.ageYearsUnit'), t('asha.ageMonthsUnit')), patient.household_hhid].filter(Boolean).join(' • ')}
                      </Text>
                    </View>

                    <View className={cx('shrink-0 flex-row items-center gap-1 rounded-full px-2.5 py-1', chip.cls)}>
                      <Icon name={chip.icon} size={14} />
                      <Text className="font-caption text-caption font-semibold text-on-surface-variant">
                        {t(chip.labelKey)}
                      </Text>
                    </View>

                    <Icon name="chevronRight" size={20} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* The empty state carries its own CTA, so the FAB only appears once there
          is a list to add to — two identical buttons stacked is noise. */}
      {all.length > 0 ? (
        <FAB
          icon="plus"
          accessibilityLabel={t('asha.registerPatient')}
          onPress={() => router.push('/register')}
        />
      ) : null}
    </View>
  );
}

function ageLabel(patient: PatientRow, yearsUnit: string, monthsUnit: string): string | null {
  if (patient.age_years !== null) return `${patient.age_years} ${yearsUnit}`;
  if (patient.age_months !== null) return `${patient.age_months} ${monthsUnit}`;
  return null;
}
