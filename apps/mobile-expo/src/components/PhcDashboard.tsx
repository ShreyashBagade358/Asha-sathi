import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { tokenStore } from '@/auth/tokenStore';
import {
  getDashboardKpis,
  listPatients,
  listTasks,
  type DashboardKpis,
  type PatientRow,
  type TaskWithPatient,
} from '@/db/clinical';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StatCard } from '@/components/ui/StatCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { LanguageToggle } from '@/components/LanguageToggle';
import { MoreButton } from '@/nav/MoreSheet';
import { useLocalization } from '@/i18n/useLocalization';
import { subscribeOnline, subscribeSync } from '@/sync/network';
import { colors, shadow } from '@/theme';

/* ── Quick Access tiles ─────────────────────────────────────────────── */

type QuickTile = {
  label: string;
  icon: IconName;
  path: string;
  fg: string;
  bg: string;
};

const QUICK_ACCESS: QuickTile[] = [
  { label: 'Households', icon: 'box', path: '/households', fg: colors.secondary, bg: colors.tealLight },
  { label: 'Maternal', icon: 'heart', path: '/pregnancy', fg: colors.maternal, bg: colors.maternalLight },
  { label: 'Child Health', icon: 'users', path: '/child-health', fg: colors.amber, bg: colors.amberLight },
  { label: 'Vaccination', icon: 'checkCircle', path: '/child-health', fg: colors.secondary, bg: colors.tealLight },
  { label: 'Referrals', icon: 'fileText', path: '/referrals', fg: colors.primary, bg: colors.primaryFixed },
  { label: 'Tasks', icon: 'calendar', path: '/tasks', fg: colors.primary, bg: colors.primaryFixed },
  { label: 'Analytics', icon: 'barChart', path: '/sync', fg: colors.tertiary, bg: '#CCFBF1' },
  { label: 'Alerts', icon: 'alert', path: '/notifications', fg: colors.error, bg: colors.errorContainer },
];

/* ── Risk summary card ──────────────────────────────────────────────── */

function RiskCard({ label, count, sublabel, icon, fg, bg }: {
  label: string;
  count: number;
  sublabel: string;
  icon: IconName;
  fg: string;
  bg: string;
}) {
  return (
    <View
      className="flex-1 rounded-2xl border border-outline-variant/30 p-3.5"
      style={[shadow.card, { backgroundColor: bg }]}
    >
      {/* Row 1: icon + label — fixed height */}
      <View className="h-8 flex-row items-start gap-1.5">
        <Icon name={icon} size={14} color={fg} />
        <Text className="flex-1 font-caption text-caption font-semibold" style={{ color: fg }} numberOfLines={2}>
          {label}
        </Text>
      </View>
      {/* Row 2: count — fixed height */}
      <View className="mt-1 h-9 justify-center">
        <Text className="font-headline-lg-bold text-headline-lg" style={{ color: fg }}>
          {count}
        </Text>
      </View>
      {/* Row 3: sublabel — single line */}
      <Text className="mt-0.5 font-caption text-caption" style={{ color: fg, opacity: 0.7 }} numberOfLines={1}>
        {sublabel}
      </Text>
    </View>
  );
}

/* ── Immunization coverage ring ─────────────────────────────────────── */

function CoverageCard({ coverage, dosesGiven, dosesDue }: {
  coverage: number;
  dosesGiven: number;
  dosesDue: number;
}) {
  const pct = Math.min(100, Math.max(0, coverage));
  return (
    <View className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4" style={shadow.card}>
      <View className="flex-row items-center gap-3">
        {/* Progress ring (simplified as a bar for RN) */}
        <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: colors.tealLight }}>
          <Text className="font-headline-md text-headline-md font-bold" style={{ color: colors.secondary }}>
            {pct.toFixed(0)}%
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-label-md text-label-md font-semibold text-on-surface">Immunization</Text>
          <Text className="font-caption text-caption text-on-surface-variant">Coverage across villages</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container">
        <View
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: colors.secondary }}
        />
      </View>

      <View className="mt-3 flex-row gap-4">
        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.secondary }} />
          <Text className="font-caption text-caption text-on-surface-variant">
            <Text className="font-bold text-on-surface">{dosesGiven}</Text> Given
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.amber }} />
          <Text className="font-caption text-caption text-on-surface-variant">
            <Text className="font-bold text-on-surface">{dosesDue}</Text> Due
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ── Worker row ─────────────────────────────────────────────────────── */

function WorkerRow({ name, area, households, score, index }: {
  name: string;
  area: string;
  households: number;
  score: string | null;
  index: number;
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarColors = [colors.primary, colors.secondary, colors.tertiary, colors.maternal, colors.amber];
  const avatarBg = avatarColors[index % avatarColors.length];

  return (
    <View className="flex-row items-center gap-3 border-b border-outline-variant/30 py-3 last:border-b-0">
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: `${avatarBg}20` }}
      >
        <Text className="font-label-md text-label-md font-bold" style={{ color: avatarBg }}>
          {initials}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="font-label-md text-label-md font-semibold text-on-surface" numberOfLines={1}>
          {name}
        </Text>
        <Text className="font-caption text-caption text-on-surface-variant" numberOfLines={1}>
          {area} · {households} households
        </Text>
      </View>
      <View className="items-end">
        <View className="rounded-full bg-secondary-container px-2 py-0.5">
          <Text className="font-caption text-caption font-semibold text-on-secondary-container">Active</Text>
        </View>
        {score ? (
          <Text className="mt-1 font-caption text-caption font-bold" style={{ color: colors.secondary }}>
            {score}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ── Main dashboard ─────────────────────────────────────────────────── */

export function PhcDashboard() {
  const { t, locale } = useLocalization();

  const [name, setName] = useState('');
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [patientCount, setPatientCount] = useState(0);
  const [tasks, setTasks] = useState<TaskWithPatient[]>([]);
  const [risky, setRisky] = useState<PatientRow[]>([]);
  const [online, setOnline] = useState(false);

  const load = useCallback(async () => {
    const [kpi, allPatients, allTasks, highRisk] = await Promise.all([
      getDashboardKpis(),
      listPatients({}),
      listTasks('all'),
      listPatients({ risk: 'high' }),
    ]);
    setKpis(kpi);
    setPatientCount(allPatients.length);
    setTasks(allTasks);
    setRisky(highRisk);
  }, []);

  useEffect(() => {
    void (async () => {
      const user = await tokenStore.getUser();
      setName(user?.full_name?.split(' ')[0] ?? '');
    })();
    void load();
  }, [load]);

  useEffect(() => subscribeOnline(setOnline), []);

  useEffect(() => subscribeSync((result) => {
    if (result) void load();
  }), [load]);

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'asha.greetingMorning' : hour < 17 ? 'asha.greetingAfternoon' : 'asha.greetingEvening';
  const today = new Date().toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const pending = tasks.filter((x) => x.status !== 'completed' && x.status !== 'done' && x.status !== 'cancelled');

  // Derived programme stats
  const households = kpis?.households ?? 0;
  const coverage = patientCount > 0 ? Math.round((patientCount / Math.max(patientCount, 30)) * 100) : 0;

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-4 pb-28" showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-caption text-caption font-medium text-on-surface-variant">{today}</Text>
            <Text className="mt-1 font-headline-lg-bold text-headline-lg text-on-surface">
              {t(greetingKey, { name: name || '—' })}
            </Text>
            <Text className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
              {t('phc.dashboardSubtitle')}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {!online ? (
              <View className="flex-row items-center gap-1 rounded-full bg-error-container px-2.5 py-1">
                <View className="h-1.5 w-1.5 rounded-full bg-error" />
                <Text className="font-caption text-caption font-semibold text-on-error-container">{t('nav.offline')}</Text>
              </View>
            ) : null}
            <LanguageToggle onSurface />
            <MoreButton />
          </View>
        </View>

        {/* ── KPI Grid (2×2) ── */}
        <View className="gap-3">
          {[0, 2].map((start) => (
            <View key={start} className="flex-row gap-3">
              <StatCard
                label="ASHA Workers"
                value={5}
                hint="6 active"
                icon="users"
                tone="primary"
              />
              <StatCard
                label="Beneficiaries"
                value={patientCount}
                hint={`Across ${households} villages`}
                icon="user"
                tone="secondary"
              />
            </View>
          ))}
          <View className="flex-row gap-3">
            <StatCard
              label="Follow-ups Due"
              value={pending.length}
              hint={risky.length > 0 ? `${risky.length} overdue` : 'All clear'}
              icon="calendar"
              tone="tertiary"
            />
            <StatCard
              label="High Risk"
              value={risky.length}
              hint="Need attention"
              icon="alert"
              tone="error"
            />
          </View>
        </View>

        {/* ── Risk Summary ── */}
        <View>
          <SectionHeader title="Risk Overview" subtitle="Pregnancy risk distribution" />
          <View className="flex-row gap-2.5">
            <RiskCard
              label="High Risk"
              count={risky.length}
              sublabel="pregnancies"
              icon="alert"
              fg={colors.error}
              bg={colors.errorContainer}
            />
            <RiskCard
              label="Medium"
              count={0}
              sublabel="pregnancies"
              icon="alertCircle"
              fg={colors.amber}
              bg={colors.amberLight}
            />
            <RiskCard
              label="Low Risk"
              count={3}
              sublabel="pregnancies"
              icon="checkCircle"
              fg={colors.secondary}
              bg={colors.tealLight}
            />
          </View>
        </View>

        {/* ── Active Pregnancies banner ── */}
        <View
          className="overflow-hidden rounded-2xl border border-outline-variant/30"
          style={[shadow.card, { backgroundColor: colors.maternalLight }]}
        >
          <View className="absolute bottom-0 left-0 top-0 w-1.5" style={{ backgroundColor: colors.maternal }} />
          <View className="flex-row items-center gap-3 p-4 pl-5">
            <View
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: `${colors.maternal}25` }}
            >
              <Icon name="heart" size={22} color={colors.maternal} />
            </View>
            <View className="flex-1">
              <Text className="font-headline-md text-headline-md font-semibold text-on-surface">
                Active Pregnancies
              </Text>
              <Text className="font-caption text-caption text-on-surface-variant">
                ANC coverage 100%
              </Text>
            </View>
            <Text className="font-display-lg text-display-lg font-bold" style={{ color: colors.maternal }}>
              3
            </Text>
          </View>
        </View>

        {/* ── Immunization Coverage ── */}
        <View>
          <SectionHeader
            title="Immunization"
            subtitle="Coverage report"
            action={
              <Pressable accessibilityRole="link">
                <Text className="font-label-md text-label-md font-semibold text-primary">View Report</Text>
              </Pressable>
            }
          />
          <CoverageCard coverage={81.82} dosesGiven={9} dosesDue={2} />
        </View>

        {/* ── Quick Access Grid ── */}
        <View>
          <SectionHeader title="Quick Access" />
          <View className="flex-row flex-wrap gap-3">
            {QUICK_ACCESS.map((tile) => (
              <Pressable
                key={tile.label}
                accessibilityRole="link"
                accessibilityLabel={tile.label}
                onPress={() => router.push(tile.path as never)}
                className="w-[22%] items-center gap-1.5 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3 active:scale-95"
                style={shadow.card}
              >
                <View
                  className="h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: tile.bg }}
                >
                  <Icon name={tile.icon} size={20} color={tile.fg} />
                </View>
                <Text
                  className="text-center font-caption text-caption font-semibold leading-tight text-on-surface"
                  numberOfLines={2}
                >
                  {tile.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── ASHA Workers ── */}
        <View>
          <SectionHeader
            title="ASHA Workers"
            subtitle="Active field staff"
            action={
              <View className="flex-row items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5">
                <Icon name="refresh" size={10} color={colors.onSecondaryContainer} />
                <Text className="font-caption text-caption font-semibold text-on-secondary-container">Sync</Text>
              </View>
            }
          />
          <View className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4" style={shadow.card}>
            <WorkerRow name="ASHA Worker" area="Khasra" households={1} score="90%" index={0} />
            <WorkerRow name="Kamla Devi" area="Khasra" households={0} score={null} index={1} />
            <WorkerRow name="Kavita" area="Khasra" households={0} score={null} index={2} />
            <WorkerRow name="Rekha Devi" area="—" households={0} score={null} index={3} />
            <WorkerRow name="Samruddhi Gore" area="—" households={2} score={null} index={4} />
          </View>
        </View>

        {/* ── Village Overview ── */}
        <View>
          <SectionHeader
            title="Village Overview"
            subtitle="1 villages covered"
            action={
              <Icon name="mapPin" size={16} color={colors.onSurfaceVariant} />
            }
          />
          <View className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest overflow-hidden" style={shadow.card}>
            {/* Table header */}
            <View className="flex-row border-b border-outline-variant/40 bg-surface-container-low px-4 py-2.5">
              <Text className="flex-[2] font-label-sm text-label-sm font-semibold text-on-surface-variant">Village</Text>
              <Text className="flex-1 font-label-sm text-label-sm font-semibold text-on-surface-variant">Patients</Text>
              <Text className="flex-1 font-label-sm text-label-sm font-semibold text-on-surface-variant">Preg.</Text>
              <Text className="flex-1 font-label-sm text-label-sm font-semibold text-on-surface-variant">Worker</Text>
            </View>
            {/* Table row */}
            <View className="flex-row items-center px-4 py-3">
              <View className="flex-[2] flex-row items-center gap-2">
                <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: colors.primaryFixed }}>
                  <Icon name="mapPin" size={12} color={colors.primary} />
                </View>
                <Text className="font-label-md text-label-md font-semibold text-on-surface">Khasra</Text>
              </View>
              <Text className="flex-1 font-body-sm text-body-sm text-on-surface">{patientCount}</Text>
              <Text className="flex-1 font-body-sm text-body-sm" style={{ color: colors.maternal }}>3</Text>
              <Text className="flex-1 font-caption text-caption text-on-surface-variant" numberOfLines={1}>ASHA</Text>
            </View>
          </View>
        </View>

        {/* ── Critical Alerts ── */}
        <View>
          <SectionHeader title="Critical Alerts" tone="error" />
          {risky.length === 0 ? (
            <View className="flex-row items-center justify-center gap-2 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5">
              <Icon name="checkCircle" size={18} color={colors.secondary} />
              <Text className="font-body-sm text-body-sm text-on-surface-variant">No critical alerts right now.</Text>
            </View>
          ) : (
            <View className="gap-2.5">
              {risky.slice(0, 5).map((patient) => (
                <Pressable
                  key={patient.id}
                  onPress={() => router.push(`/patient/${patient.id}` as never)}
                  className="overflow-hidden rounded-2xl border border-error/20 bg-error-container p-3.5 pl-4 active:scale-[0.98]"
                >
                  <View className="absolute bottom-0 left-0 top-0 w-1.5 bg-error" />
                  <View className="flex-row items-center gap-3">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-error/15">
                      <Icon name="alert" size={16} color={colors.error} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-label-md text-label-md font-semibold text-on-error-container">
                        {patient.full_name}
                      </Text>
                      <Text className="font-caption text-caption text-on-error-container/70">
                        {patient.age_years != null ? `${patient.age_years}y · ` : ''}{patient.phone ?? ''}
                      </Text>
                    </View>
                    <Icon name="chevronRight" size={16} color={colors.onErrorContainer} />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
