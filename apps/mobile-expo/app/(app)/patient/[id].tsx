import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Card, Divider } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
 */

type Tab = 'summary' | 'history' | 'maternal' | 'vaccination' | 'referrals';

const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'asha.riskLowLabel',
  medium: 'asha.riskMediumLabel',
  high: 'asha.riskHighLabel',
};

const RISK_RAIL: Record<RiskLevel, string> = {
  low: '#1E6F5C',
  medium: '#FF8C00',
  high: '#BA1A1A',
};

const TABS: Tab[] = ['summary', 'history', 'maternal', 'vaccination', 'referrals'];

type Detail = {
  patient: PatientRow;
  address: string | null;
  members: HouseholdMember[];
  conditions: string[];
  pregnancies: Pregnancy[];
  children: Child[];
  ancVisits: Array<{ date: string | null; pregnancy: string; detail: string }>;
  immunizations: Array<{ child: string; label: string; due: string | null; given: string | null }>;
  referrals: Referral[];
};

export default function PatientDetailScreen() {
  const { t } = useLocalization();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('summary');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const patient = await getPatient(String(id));
      if (!patient) {
        setMissing(true);
        return;
      }

      const [address, members, pregnancies, children, referrals, screenings] = await Promise.all([
        patient.household_id ? getHouseholdAddress(patient.household_id) : Promise.resolve(null),
        patient.household_id ? listHouseholdMembers(patient.household_id, patient.id) : Promise.resolve([]),
        listPregnancies(patient.id),
        listChildren(patient.id),
        listReferrals(patient.id),
        listNcdScreenings(patient.id),
      ]);

      const ancVisits = (
        await Promise.all(
          pregnancies.map(async (pregnancy) =>
            (await listAncVisits(pregnancy.id)).map((visit) => ({
              date: visit.visit_date,
              pregnancy: t('asha.tabMaternal'),
              detail: `ANC ${visit.visit_number ?? '?'} · ${visit.bp_systolic ?? '—'}/${visit.bp_diastolic ?? '—'} · Hb ${visit.hemoglobin ?? '—'}`,
            })),
          ),
        )
      ).flat();

      const immunizations = (
        await Promise.all(
          children.map(async (child) => {
            const rows = await listImmunizations(child.id);
            return rows.map((row) => ({
              child: child.birth_registration_no ?? child.id.slice(0, 8),
              label: row.vaccine_name ?? row.vaccine_code ?? '—',
              due: row.due_date,
              given: row.given_date,
            }));
          }),
        )
      ).flat();

      setDetail({ patient, address, members, conditions: conditionsFrom(screenings), pregnancies, children, ancVisits, immunizations, referrals });
    })();
  }, [id, t]);

  const history = useMemo(() => {
    if (!detail) return [];
    const rows = [
      ...detail.referrals.map((r) => ({
        key: r.id,
        date: r.initiated_at,
        title: r.referral_type ?? t('asha.referrals'),
        note: r.reason ?? '',
        urgent: (r.urgency ?? '').toLowerCase() === 'high' || (r.urgency ?? '').toLowerCase() === 'emergency',
      })),
      ...detail.ancVisits.map((v) => ({ key: `${v.date}-${v.detail}`, date: v.date, title: v.pregnancy, note: v.detail, urgent: false })),
      ...detail.immunizations
        .filter((i) => i.given)
        .map((i) => ({ key: `${i.child}-${i.label}-${i.given}`, date: i.given, title: i.label, note: i.child, urgent: false })),
    ];
    return rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, [detail, t]);

  if (missing) {
    return (
      <Screen title={t('nav.patientDetails')} back withTabBar={false}>
        <EmptyState title={t('common.noResults')} />
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen title={t('nav.patientDetails')} back withTabBar={false}>
        <View className="flex-1" />
      </Screen>
    );
  }

  const { patient } = detail;
  const activePregnancy = detail.pregnancies.find((p) => !['delivered', 'aborted', 'closed'].includes(p.status)) ?? detail.pregnancies[0];

  return (
    <Screen title={patient.full_name} subtitle={patient.beneficiary_id ?? undefined} back withTabBar={false} scroll={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row border-b border-outline-variant">
        {TABS.map((key) => (
          <TabButton key={key} active={tab === key} label={t(`asha.tab${key.charAt(0).toUpperCase()}${key.slice(1)}`)} onPress={() => setTab(key)} />
        ))}
      </ScrollView>

      <ScrollView contentContainerClassName="gap-5 px-4 pb-8" showsVerticalScrollIndicator={false}>
      {tab === 'summary' ? (
        <View className="gap-5">
          <Card rail={RISK_RAIL[patient.risk]} railWidth={8}>
            <View className="flex-row items-center gap-4 p-5 pl-6">
              <View className="h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-surface-container-lowest bg-primary-container">
                <Text className="font-display-lg text-display-lg font-bold text-on-primary-container">
                  {patient.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1 gap-2">
                <View className="flex-row items-center gap-2">
                  <Text className="font-label-md text-label-md font-semibold text-on-surface">{t('asha.age')}</Text>
                  <Text className="font-body-md text-body-md font-semibold text-on-surface">{ageOf(patient, t('asha.ageYearsUnit'), t('asha.ageMonthsUnit'))}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="font-label-md text-label-md font-semibold text-on-surface">{t('asha.gender')}</Text>
                  <Text className="font-body-md text-body-md font-semibold text-on-surface">{patient.gender ?? '—'}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="font-label-md text-label-md font-semibold text-on-surface">{t('asha.primaryLanguage')}</Text>
                  <Text className="font-body-md text-body-md font-semibold text-on-surface">{t('asha.hindi')}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="font-label-md text-label-md font-semibold text-on-surface">{t('nav.patientDetails')}</Text>
                  <Text className="font-body-md text-body-md font-semibold text-on-surface">{patient.beneficiary_id ?? '—'}</Text>
                </View>
              </View>
            </View>
          </Card>

          <View className="gap-3">
            <SectionTitle icon="fileText" title={t('asha.contactDetails')} />
            <Card>
              <View className="gap-4 p-5">
                <InfoRow icon="phone" label={t('asha.phoneNumber')} value={patient.phone || '—'} />
                <InfoRow icon="mapPin" label={t('asha.address')} value={detail.address || '—'} />
                <InfoRow icon="box" label={t('asha.householdMembers')} value={patient.household_hhid || '—'} />
              </View>
            </Card>
          </View>

          <View className="gap-3">
            <SectionTitle icon="activity" title={t('asha.activeConditions')} tone="text-error" />
            <Card>
              {detail.conditions.length === 0 ? (
                <Text className="p-5 font-body-md text-body-md text-on-surface-variant">{t('asha.noConditions')}</Text>
              ) : (
                <View className="gap-2 p-3">
                  {detail.conditions.map((condition) => (
                    <View key={condition} className="flex-row items-center justify-between rounded-lg border border-outline-variant/50 bg-surface-container p-3">
                      <Text className="font-body-md text-body-md font-semibold text-on-surface">{condition}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </View>

          <View className="gap-3">
            <SectionTitle icon="users" title={t('asha.householdMembers')} />
            <Card>
              {detail.members.length === 0 ? (
                <Text className="p-5 font-body-md text-body-md text-on-surface-variant">{t('common.noResults')}</Text>
              ) : (
                <View className="gap-2 p-3">
                  {detail.members.map((member) => (
                    <View key={member.id} className="relative flex-row items-center gap-2 overflow-hidden rounded-lg border border-outline-variant p-3">
                      {member.isSubject ? <View className="absolute bottom-0 left-0 top-0 w-1 bg-secondary" /> : null}
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-container">
                        <Text className="font-label-md text-label-md font-bold text-primary">
                          {member.full_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="font-label-md text-label-md text-on-surface">{member.full_name}</Text>
                        <Text className="font-caption text-caption text-on-surface-variant">{ageOf(member, t('asha.ageYearsUnit'), t('asha.ageMonthsUnit'))}</Text>
                      </View>
                      {member.isSubject ? <Icon name="checkCircle" size={18} /> : <Icon name="chevronRight" size={18} />}
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </View>
        </View>
      ) : null}

      {tab === 'history' ? (
        <View className="gap-3">
          <SectionTitle icon="fileText" title={t('asha.medicalHistory')} />
          {history.length === 0 ? (
            <Card>
              <Text className="p-5 font-body-md text-body-md text-on-surface-variant">{t('asha.noConditions')}</Text>
            </Card>
          ) : (
            <Card>
              <View className="gap-3 p-4">
                {history.map((row) => (
                  <View key={row.key} className="flex-row items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container p-4">
                    <View className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', row.urgent ? 'bg-error' : 'bg-secondary')} />
                    <View className="flex-1">
                      <View className="flex-row items-start justify-between gap-2">
                        <Text className="font-body-md text-body-md font-semibold text-on-surface">{row.title}</Text>
                        <Text className="font-caption text-caption text-on-surface-variant">{row.date ?? '—'}</Text>
                      </View>
                      {row.note ? <Text className="font-caption text-caption text-on-surface-variant">{row.note}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </View>
      ) : null}

      {tab === 'maternal' ? (
        <View className="gap-3">
          <SectionTitle icon="heart" title={t('asha.maternalHealth')} />
          {!activePregnancy ? (
            <Card>
              <Text className="p-5 font-body-md text-body-md text-on-surface-variant">{t('asha.notPregnant')}</Text>
            </Card>
          ) : (
            <View className="gap-3">
              <View className="flex-row gap-3">
                <Metric label={t('asha.trimester')} value={trimesterOf(activePregnancy)} />
                <Metric label={t('asha.ancVisits')} value={`${activePregnancy.anc_count ?? 0} / 8`} />
                <Metric label={t('asha.edd')} value={activePregnancy.edd ?? '—'} />
              </View>
              <Card>
                <View className="gap-2 p-4">
                  <InfoRow label={t('asha.gravida')} value={String(activePregnancy.gravida ?? '—')} />
                  <Divider />
                  <InfoRow label={t('asha.parity')} value={String(activePregnancy.parity ?? '—')} />
                  <Divider />
                  <InfoRow label="Next ANC" value={activePregnancy.next_anc_due ?? '—'} />
                </View>
              </Card>
            </View>
          )}
        </View>
      ) : null}

      {tab === 'vaccination' ? (
        <View className="gap-3">
          <SectionTitle icon="checkCircle" title={t('asha.vaccinationStatus')} />
          {detail.immunizations.length === 0 ? (
            <Card>
              <View className="gap-3 p-5">
                <Text className="font-body-md text-body-md text-on-surface-variant">{t('asha.vaccinationHint')}</Text>
                <Button label={t('asha.viewSchedule')} icon="calendar" onPress={() => setTab('vaccination')} />
              </View>
            </Card>
          ) : (
            <Card>
              <View className="gap-2 p-3">
                {detail.immunizations.map((row) => (
                  <View key={`${row.child}-${row.label}-${row.due}`} className="flex-row items-center justify-between gap-3 rounded-lg border border-outline-variant/50 bg-surface-container p-3">
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
        </View>
      ) : null}

      {tab === 'referrals' ? (
        <View className="gap-3">
          <SectionTitle icon="activity" title={t('asha.referrals')} />
          {detail.referrals.length === 0 ? (
            <Card>
              <Text className="p-5 font-body-md text-body-md text-on-surface-variant">{t('common.noResults')}</Text>
            </Card>
          ) : (
            <Card>
              <View className="gap-3 p-4">
                {detail.referrals.map((referral) => (
                  <View key={referral.id} className="flex-row items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container p-4">
                    <Icon name="chevronRight" size={18} />
                    <View className="flex-1">
                      <View className="flex-row items-start justify-between gap-2">
                        <Text className="font-body-md text-body-md font-semibold text-on-surface">
                          {referral.referral_type ?? '—'}
                        </Text>
                        <Text className="font-caption text-caption text-on-surface-variant">{referral.initiated_at ?? '—'}</Text>
                      </View>
                      {referral.reason ? (
                        <Text className="font-body-md text-body-md text-on-surface-variant">{referral.reason}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </View>
      ) : null}
      </ScrollView>
    </Screen>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={cx(
        'border-b-2 px-3 py-2 font-label-md text-label-md font-semibold',
        active ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant',
      )}
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
      {icon ? <View className="mt-0.5"><Icon name={icon} size={18} /></View> : null}
      <View className="flex-1">
        <Text className="font-caption text-caption text-on-surface-variant">{label}</Text>
        <Text className="font-body-md text-body-md text-on-surface">{value}</Text>
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-lg border border-outline-variant/50 bg-surface-container p-4">
      <Text className="font-caption text-caption text-on-surface-variant">{label}</Text>
      <Text className="mt-1 font-headline-md text-headline-md font-semibold text-on-surface">{value}</Text>
    </View>
  );
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

function trimesterOf(pregnancy: Pregnancy): string {
  if (!pregnancy.lmp) return '—';
  const weeks = Math.floor((Date.now() - new Date(pregnancy.lmp).getTime()) / (7 * 24 * 3600 * 1000));
  if (weeks < 0) return '—';
  if (weeks < 14) return '1';
  if (weeks < 28) return '2';
  return '3';
}

/** Turn NCD screening rows into the condition chips the web hardcodes. */
function conditionsFrom(screenings: NcdScreening[]): string[] {
  const out = new Set<string>();
  for (const screening of screenings) {
    if (riskFlag(screening.diabetes_risk)) out.add('Diabetes');
    if (riskFlag(screening.hypertension_risk)) out.add('Hypertension');
    if (screening.bp_systolic !== null && screening.bp_systolic >= 140) out.add('High blood pressure');
    if (screening.blood_sugar_random !== null && screening.blood_sugar_random >= 200) out.add('High blood sugar');
  }
  return [...out];
}

function riskFlag(value: string | null): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === 'high' || v === 'yes' || v === 'true' || v === 'positive';
}
