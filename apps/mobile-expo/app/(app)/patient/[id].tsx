import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Screen } from '@/components/Screen';
import {
  getHouseholdAddress,
  getPatient,
  listAncVisits,
  listChildren,
  listHouseholdMembers,
  listImmunizations,
  listNcdScreenings,
  listPregnancies,
  listReferrals,
  type AncVisit,
  type Child,
  type HouseholdMember,
  type NcdScreening,
  type PatientRow,
  type Pregnancy,
  type Referral,
  type RiskLevel,
} from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';

type Translate = ReturnType<typeof useLocalization>['t'];

/**
 * Port of PatientDetailsAshaSathi.tsx.
 *
 * The web page is almost entirely mock data: `householdMembers`, `referralLog`,
 * `activeConditions`, blood group, address, and a hardcoded '4 / 8' ANC count
 * and EDD. Every one of those has a real source in local SQLite here, so the tabs
 * are wired to actual rows instead:
 *  - summary  -> demographics, real household members, real NCD conditions
 *  - history  -> referrals + ANC visits + immunizations, merged by date
 *  - maternal -> the active pregnancy record (real LMP/EDD/ANC count)
 *  - vaccination -> the patient's children's immunization rows
 *  - referrals -> the patient's real referrals
 *
 * Unlike the web, which can render every query at once behind React Query, each
 * tab here loads only what it shows, so a tab can say "Loading maternal
 * record…" rather than blanking the page. Switching tabs refetches: the queries
 * are a couple of local SQLite reads, and the loading copy is worth more than
 * the repeat read.
 */

type Tab = 'summary' | 'history' | 'maternal' | 'vaccination' | 'referrals';

const RISK_RAIL: Record<RiskLevel, string> = {
  low: '#1E6F5C',
  medium: '#FF8C00',
  high: '#BA1A1A',
};

const TABS: Tab[] = ['summary', 'history', 'maternal', 'vaccination', 'referrals'];

/** Copy shown while a tab's rows are still being read. `null` means "loading". */
const LOADING_KEY: Record<Tab, string> = {
  summary: 'asha.loadingMembers',
  history: 'asha.loadingHistory',
  maternal: 'asha.loadingMaternal',
  vaccination: 'common.loading',
  referrals: 'asha.loadingReferrals',
};

type Condition = { label: string; date: string | null };

type SummaryData = {
  members: HouseholdMember[];
  conditions: Condition[];
};

/** Raw rows for the merged history timeline; labels are resolved at render. */
type HistorySource = {
  referrals: Referral[];
  ancVisits: AncVisit[];
  givenDoses: Array<{ child: string; label: string; given: string }>;
};

type MaternalData = { pregnancy: Pregnancy | null; ancVisits: AncVisit[] };

type Dose = { key: string; child: string; label: string; due: string | null; given: string | null };

type VaccinationData = { children: Child[]; doses: Dose[] };

export default function PatientDetailScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('summary');

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [history, setHistory] = useState<HistorySource | null>(null);
  const [maternal, setMaternal] = useState<MaternalData | null>(null);
  const [vaccination, setVaccination] = useState<VaccinationData | null>(null);
  const [referrals, setReferrals] = useState<Referral[] | null>(null);

  useEffect(() => {
    if (!id) {
      setMissing(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const row = await getPatient(String(id));
      if (cancelled) return;
      if (!row) {
        setMissing(true);
        return;
      }
      const home = row.household_id ? await getHouseholdAddress(row.household_id) : null;
      if (cancelled) return;
      setPatient(row);
      setAddress(home);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!patient) return;
    let cancelled = false;

    // Drop the previous tab's rows first so the switch shows its own loading
    // copy instead of stale data from the tab the user just left.
    setSummary(null);
    setHistory(null);
    setMaternal(null);
    setVaccination(null);
    setReferrals(null);

    void (async () => {
      if (tab === 'summary') {
        const [members, screenings] = await Promise.all([
          patient.household_id ? listHouseholdMembers(patient.household_id, patient.id) : Promise.resolve([]),
          listNcdScreenings(patient.id),
        ]);
        if (cancelled) return;
        setSummary({ members, conditions: conditionsFrom(screenings) });
        return;
      }

      if (tab === 'history') {
        const [referralRows, pregnancies, children] = await Promise.all([
          listReferrals(patient.id),
          listPregnancies(patient.id),
          listChildren(patient.id),
        ]);
        const ancVisits = (await Promise.all(pregnancies.map((p) => listAncVisits(p.id)))).flat();
        const givenDoses = (
          await Promise.all(
            children.map(async (child) =>
              (await listImmunizations(child.id))
                .filter((row) => row.given_date)
                .map((row) => ({
                  child: child.birth_registration_no ?? child.id.slice(0, 8),
                  label: row.vaccine_name ?? row.vaccine_code ?? '—',
                  given: row.given_date as string,
                })),
            ),
          )
        ).flat();
        if (cancelled) return;
        setHistory({ referrals: referralRows, ancVisits, givenDoses });
        return;
      }

      if (tab === 'maternal') {
        const pregnancies = await listPregnancies(patient.id);
        const pregnancy = pregnancies.find((p) => !CLOSED_STATUSES.includes(p.status)) ?? pregnancies[0] ?? null;
        const ancVisits = pregnancy ? await listAncVisits(pregnancy.id) : [];
        if (cancelled) return;
        setMaternal({ pregnancy, ancVisits });
        return;
      }

      if (tab === 'vaccination') {
        const children = await listChildren(patient.id);
        const doses = (
          await Promise.all(
            children.map(async (child) =>
              (await listImmunizations(child.id)).map((row) => ({
                key: row.id,
                child: child.birth_registration_no ?? child.id.slice(0, 8),
                label: row.vaccine_name ?? row.vaccine_code ?? '—',
                due: row.due_date,
                given: row.given_date,
              })),
            ),
          )
        ).flat();
        if (cancelled) return;
        setVaccination({ children, doses });
        return;
      }

      const rows = await listReferrals(patient.id);
      if (cancelled) return;
      setReferrals(rows);
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, patient]);

  const historyRows = useMemo(() => buildHistory(t, history), [t, history]);

  if (missing || !patient) {
    return (
      <Screen title={t('nav.patientDetails')} back withTabBar={false}>
        {missing ? (
          <EmptyState title={t('common.noResults')} icon="users" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="font-body-md text-body-md text-on-surface-variant">{t('common.loading')}</Text>
          </View>
        )}
      </Screen>
    );
  }

  const loadingCard = (
    <Card>
      <Text className="p-5 font-body-md text-body-md text-on-surface-variant">{t(LOADING_KEY[tab])}</Text>
    </Card>
  );

  let body: ReactNode;
  if (tab === 'summary') {
    body = summary ? (
      <View className="gap-5">
        <Card rail={RISK_RAIL[patient.risk]} railWidth={8}>
          <View className="flex-row items-center gap-4 p-5 pl-6">
            <View className="h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-surface-container-lowest bg-primary-container">
              <Text className="font-display-lg text-display-lg font-bold text-on-primary-container">
                {patient.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1 gap-2">
              <Fact label={t('asha.age')} value={ageOf(patient, t('asha.ageYearsUnit'), t('asha.ageMonthsUnit'))} />
              <Fact label={t('asha.gender')} value={patient.gender ?? t('asha.notRecorded')} />
              <Fact label={t('asha.primaryLanguage')} value={t('asha.hindi')} />
              <Text className="font-caption text-caption text-on-surface-variant">
                {[
                  t('asha.regId', { abha: patient.abha_id ?? '—' }),
                  t('asha.lastUpdatedOn', { date: formatDate(patient.updated_at) }),
                ].join(' · ')}
              </Text>
            </View>
          </View>
        </Card>

        <Button
          label={t('asha.viewHealthProfile')}
          icon="heart"
          variant="ghost"
          shape="pill"
          full
          onPress={() => {
            if (id) router.push(`/patient/${id}/profile`);
          }}
        />

        <View className="gap-3">
          <SectionTitle icon="fileText" title={t('asha.contactDetails')} />
          <Card>
            <View className="gap-4 p-5">
              <InfoRow icon="phone" label={t('asha.phoneNumber')} value={patient.phone || '—'} />
              <InfoRow icon="mapPin" label={t('asha.address')} value={address || '—'} />
              <InfoRow
                icon="box"
                label={t('asha.householdMembers')}
                value={patient.household_hhid || t('asha.patientNoHousehold')}
              />
            </View>
          </Card>
        </View>

        <View className="gap-3">
          <SectionTitle icon="activity" title={t('asha.activeConditions')} tone="text-error" />
          <Card>
            {summary.conditions.length === 0 ? (
              <Text className="p-5 font-body-md text-body-md text-on-surface-variant">{t('asha.noConditions')}</Text>
            ) : (
              <View className="gap-2 p-3">
                {summary.conditions.map((condition) => (
                  <View key={condition.label} className="rounded-lg border border-outline-variant/50 bg-surface-container p-3">
                    <Text className="font-body-md text-body-md font-semibold text-on-surface">{condition.label}</Text>
                    <Text className="font-caption text-caption text-on-surface-variant">
                      {condition.date
                        ? t('asha.diagnosedOn', { date: formatDate(condition.date) })
                        : t('asha.notRecorded')}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>

        <View className="gap-3">
          <SectionTitle icon="users" title={t('asha.householdMembers')} />
          <Card>
            {!patient.household_id ? (
              <Text className="p-5 font-body-md text-body-md text-on-surface-variant">{t('asha.patientNoHousehold')}</Text>
            ) : summary.members.length === 0 ? (
              <Text className="p-5 font-body-md text-body-md text-on-surface-variant">{t('asha.noMembersRecorded')}</Text>
            ) : (
              <View className="gap-2 p-3">
                {summary.members.map((member) => {
                  const meta =
                    [
                      member.gender,
                      member.age_years !== null ? `${member.age_years} ${t('asha.ageYearsUnit')}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || t('asha.notRecorded');
                  return (
                    <View key={member.id} className="relative flex-row items-center gap-2 overflow-hidden rounded-lg border border-outline-variant p-3">
                      {member.isSubject ? <View className="absolute bottom-0 left-0 top-0 w-1 bg-secondary" /> : null}
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-container">
                        <Text className="font-label-md text-label-md font-bold text-primary">
                          {member.full_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="font-label-md text-label-md text-on-surface">{member.full_name}</Text>
                        <Text className="font-caption text-caption text-on-surface-variant">{meta}</Text>
                      </View>
                      {member.isSubject ? <Icon name="checkCircle" size={18} /> : <Icon name="chevronRight" size={18} />}
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        </View>
      </View>
    ) : (
      loadingCard
    );
  } else if (tab === 'history') {
    body = history ? (
      <View className="gap-3">
        <SectionTitle icon="fileText" title={t('asha.medicalHistory')} />
        {historyRows.length === 0 ? (
          <Card>
            <Text className="p-5 font-body-md text-body-md text-on-surface-variant">{t('asha.noRecords')}</Text>
          </Card>
        ) : (
          <Card>
            <View className="gap-3 p-4">
              {historyRows.map((row) => (
                <View key={row.key} className="flex-row items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container p-4">
                  <View className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', row.urgent ? 'bg-error' : 'bg-secondary')} />
                  <View className="flex-1">
                    <View className="flex-row items-start justify-between gap-2">
                      <Text className="font-body-md text-body-md font-semibold text-on-surface">{row.title}</Text>
                      <Text className="font-caption text-caption text-on-surface-variant">{formatDate(row.date)}</Text>
                    </View>
                    {row.note ? <Text className="font-caption text-caption text-on-surface-variant">{row.note}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}
      </View>
    ) : (
      loadingCard
    );
  } else if (tab === 'maternal') {
    body = maternal ? (
      <View className="gap-3">
        <SectionTitle icon="heart" title={t('asha.maternalHealth')} />
        {!maternal.pregnancy ? (
          <Card>
            <Text className="p-5 font-body-md text-body-md text-on-surface-variant">{t('asha.notPregnant')}</Text>
          </Card>
        ) : (
          <>
            <View className="gap-3">
              <View className="flex-row gap-3">
                <Metric label={t('asha.lmp')} value={formatDate(maternal.pregnancy.lmp)} />
                <Metric label={t('asha.edd')} value={formatDate(maternal.pregnancy.edd)} />
                <Metric label={t('asha.ancVisits')} value={`${maternal.pregnancy.anc_count} / 8`} />
              </View>
              <View className="flex-row gap-3">
                <Metric
                  label={t('asha.gravidaPara')}
                  value={t('asha.gravidaPara', {
                    gravida: maternal.pregnancy.gravida ?? '—',
                    para: maternal.pregnancy.parity ?? '—',
                  })}
                />
                <Metric label={t('asha.pregnancyStatus')} value={maternal.pregnancy.status} />
                <Metric label={t('asha.riskLevel')} value={riskLabel(maternal.pregnancy.risk_level, t)} />
              </View>
            </View>

            <View className="mt-2 gap-3">
              <SectionTitle icon="fileText" title={t('asha.ancHistory')} />
              {maternal.ancVisits.length === 0 ? (
                <Card>
                  <Text className="p-5 font-body-md text-body-md text-on-surface-variant">{t('asha.noRecords')}</Text>
                </Card>
              ) : (
                <Card>
                  <View className="gap-3 p-4">
                    {maternal.ancVisits.map((visit) => {
                      const trimester = trimesterNumber(visit.visit_date, maternal.pregnancy?.lmp ?? null);
                      return (
                        <View key={visit.id} className="rounded-lg border border-outline-variant/50 bg-surface-container p-4">
                          <View className="flex-row items-start justify-between gap-2">
                            <Text className="font-body-md text-body-md font-semibold text-on-surface">
                              {`ANC ${visit.visit_number ?? '—'}`}
                            </Text>
                            <View className="flex-row items-center gap-2">
                              {trimester ? (
                                <View className="rounded-full bg-secondary-container px-2 py-0.5">
                                  <Text className="font-caption text-caption font-semibold text-on-secondary-container">
                                    {t('asha.trimesterShort', { n: trimester })}
                                  </Text>
                                </View>
                              ) : null}
                              <Text className="font-caption text-caption text-on-surface-variant">{formatDate(visit.visit_date)}</Text>
                            </View>
                          </View>
                          <Text className="mt-0.5 font-caption text-caption text-on-surface-variant">
                            {`BP ${visit.bp_systolic ?? '—'}/${visit.bp_diastolic ?? '—'} · Hb ${visit.hemoglobin ?? '—'}`}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              )}
            </View>
          </>
        )}
      </View>
    ) : (
      loadingCard
    );
  } else if (tab === 'vaccination') {
    body = vaccination ? (
      <View className="gap-3">
        <SectionTitle icon="checkCircle" title={t('asha.vaccinationStatus')} />
        {vaccination.children.length === 0 ? (
          <EmptyState icon="users" title={t('asha.noChildRegistered')} />
        ) : vaccination.doses.length === 0 ? (
          <EmptyState icon="calendar" title={t('asha.immunizationEmpty')} description={t('asha.immunizationEmptyHint')} />
        ) : (
          <Card>
            <View className="gap-2 p-3">
              {vaccination.doses.map((row) => (
                <View key={row.key} className="flex-row items-center justify-between gap-3 rounded-lg border border-outline-variant/50 bg-surface-container p-3">
                  <View className="flex-1">
                    <Text className="font-label-md text-label-md font-semibold text-on-surface">{row.label}</Text>
                    <Text className="font-caption text-caption text-on-surface-variant">{row.child}</Text>
                  </View>
                  <View className={cx('rounded-full px-2.5 py-1', row.given ? 'bg-secondary-container' : 'bg-surface-container')}>
                    <Text className="font-caption text-caption font-semibold text-on-surface-variant">
                      {row.given ?? row.due ?? '—'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}
        <Button
          label={t('asha.viewSchedule')}
          icon="calendar"
          shape="pill"
          full
          onPress={() => {
            if (id) router.push(`/patient/${id}/immunization`);
          }}
        />
      </View>
    ) : (
      loadingCard
    );
  } else {
    body = referrals ? (
      <View className="gap-3">
        <SectionTitle icon="activity" title={t('asha.referrals')} />
        {referrals.length === 0 ? (
          <EmptyState icon="fileText" title={t('asha.noReferralsForPatient')} description={t('asha.noReferralsForPatientDesc')} />
        ) : (
          <Card>
            <View className="gap-3 p-4">
              {referrals.map((referral) => (
                <View key={referral.id} className="flex-row items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container p-4">
                  <Icon name="chevronRight" size={18} />
                  <View className="flex-1">
                    <View className="flex-row items-start justify-between gap-2">
                      <Text className="font-body-md text-body-md font-semibold text-on-surface">
                        {referral.referral_type || t('asha.refToUnspecified')}
                      </Text>
                      <Text className="font-caption text-caption text-on-surface-variant">{formatDate(referral.initiated_at)}</Text>
                    </View>
                    <Text className="font-body-md text-body-md text-on-surface-variant">
                      {referral.reason || t('asha.notRecorded')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}
      </View>
    ) : (
      loadingCard
    );
  }

  return (
    <Screen title={patient.full_name} subtitle={patient.beneficiary_id ?? undefined} back withTabBar={false} scroll={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row border-b border-outline-variant">
        {TABS.map((key) => (
          <TabButton
            key={key}
            active={tab === key}
            label={t(`asha.tab${key.charAt(0).toUpperCase()}${key.slice(1)}`)}
            onPress={() => setTab(key)}
          />
        ))}
      </ScrollView>

      <ScrollView contentContainerClassName="gap-5 px-4 pb-8" showsVerticalScrollIndicator={false}>
        {body}
      </ScrollView>
    </Screen>
  );
}

const CLOSED_STATUSES = ['delivered', 'aborted', 'closed'];

type HistoryRow = { key: string; date: string | null; title: string; note: string; urgent: boolean };

/** Merge referrals, ANC visits and given doses into one date-ordered timeline. */
function buildHistory(t: Translate, source: HistorySource | null): HistoryRow[] {
  if (!source) return [];
  const rows: HistoryRow[] = [
    ...source.referrals.map((r) => ({
      key: r.id,
      date: r.initiated_at,
      title: r.referral_type ?? t('asha.referrals'),
      note: r.reason ?? '',
      urgent: (r.urgency ?? '').toLowerCase() === 'high' || (r.urgency ?? '').toLowerCase() === 'emergency',
    })),
    ...source.ancVisits.map((v) => ({
      key: v.id,
      date: v.visit_date,
      title: `ANC ${v.visit_number ?? '—'}`,
      note: `BP ${v.bp_systolic ?? '—'}/${v.bp_diastolic ?? '—'} · Hb ${v.hemoglobin ?? '—'}`,
      urgent: false,
    })),
    ...source.givenDoses.map((d) => ({
      key: `${d.child}-${d.label}-${d.given}`,
      date: d.given,
      title: d.label,
      note: d.child,
      urgent: false,
    })),
  ];
  return rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={cx('border-b-2 px-3 py-2', active ? 'border-primary' : 'border-transparent')}
    >
      <Text className={cx('font-label-md text-label-md font-semibold', active ? 'text-primary' : 'text-on-surface-variant')}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ icon, title, tone = 'text-primary' }: { icon: IconName; title: string; tone?: string }) {
  return (
    <View className="mb-1 flex-row items-center gap-2">
      <View className={tone}>
        <Icon name={icon} size={20} />
      </View>
      <Text className={cx('font-headline-md text-headline-md font-semibold', tone === 'text-error' ? 'text-error' : 'text-on-surface')}>
        {title}
      </Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon?: IconName; label: string; value: string }) {
  return (
    <View className="flex-row items-start gap-2">
      {icon ? (
        <View className="mt-0.5">
          <Icon name={icon} size={18} />
        </View>
      ) : null}
      <View className="flex-1">
        <Text className="font-caption text-caption text-on-surface-variant">{label}</Text>
        <Text className="font-body-md text-body-md text-on-surface">{value}</Text>
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="font-label-md text-label-md font-semibold text-on-surface">{label}</Text>
      <Text className="font-body-md text-body-md font-semibold text-on-surface">{value}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-lg border border-outline-variant/50 bg-surface-container p-4">
      <Text className="font-caption text-caption text-on-surface-variant" numberOfLines={1}>
        {label}
      </Text>
      <Text className="mt-1 font-headline-md text-headline-md font-semibold text-on-surface" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Dates arrive as `YYYY-MM-DD` or an ISO timestamp. Slicing to the date part
 * and building a local Date keeps the calendar day stable; passing the raw
 * string to the Date constructor reads it as UTC and shifts it a day back for
 * anyone west of Greenwich.
 */
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

function ageOf(
  row: { age_years: number | null; age_months: number | null },
  yearsUnit: string,
  monthsUnit: string,
): string {
  if (row.age_years !== null) return `${row.age_years} ${yearsUnit}`;
  if (row.age_months !== null) return `${row.age_months} ${monthsUnit}`;
  return '—';
}

/** Which antenatal trimester a visit falls in, or null when LMP/date is absent. */
function trimesterNumber(visitDate: string | null, lmp: string | null): number | null {
  if (!visitDate || !lmp) return null;
  const weeks = Math.floor((new Date(visitDate).getTime() - new Date(lmp).getTime()) / (7 * 24 * 3600 * 1000));
  if (weeks < 0) return null;
  if (weeks < 14) return 1;
  if (weeks < 28) return 2;
  return 3;
}

function riskLabel(value: string | null, t: Translate): string {
  const v = (value ?? '').toLowerCase();
  if (v === 'high' || v === 'high_risk' || v === 'critical') return t('asha.riskHighLabel');
  if (v === 'medium' || v === 'moderate') return t('asha.riskMediumLabel');
  if (!v) return t('asha.notRecorded');
  return t('asha.riskLowLabel');
}

/**
 * Turn NCD screening rows into the condition chips the web hardcodes, keeping
 * the screening date so each one can say when it was diagnosed.
 */
function conditionsFrom(screenings: NcdScreening[]): Condition[] {
  const out = new Map<string, string | null>();
  const add = (label: string, date: string | null) => {
    if (!out.has(label)) out.set(label, date);
  };
  for (const screening of screenings) {
    if (riskFlag(screening.diabetes_risk)) add('Diabetes', screening.screening_date);
    if (riskFlag(screening.hypertension_risk)) add('Hypertension', screening.screening_date);
    if (screening.bp_systolic !== null && screening.bp_systolic >= 140) {
      add('High blood pressure', screening.screening_date);
    }
    if (screening.blood_sugar_random !== null && screening.blood_sugar_random >= 200) {
      add('High blood sugar', screening.screening_date);
    }
  }
  return [...out].map(([label, date]) => ({ label, date }));
}

function riskFlag(value: string | null): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === 'high' || v === 'yes' || v === 'true' || v === 'positive';
}
