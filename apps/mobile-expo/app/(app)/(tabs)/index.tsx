import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StatCard } from '@/components/ui/StatCard';
import { tokenStore } from '@/auth/tokenStore';
import { getQueueCounts } from '@/db/database';
import {
  getDashboardKpis,
  listPatients,
  listTasks,
  setTaskStatus,
  type DashboardKpis,
  type PatientRow,
  type TaskWithPatient,
} from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';
import { LanguageToggle } from '@/components/LanguageToggle';
import { MoreButton } from '@/nav/MoreSheet';
import { PhcDashboard } from '@/components/PhcDashboard';
import { scheduleSync, subscribeOnline, subscribeSync } from '@/sync/network';
import { colors } from '@/theme';
import { cx } from '@/cx';
import { shadow, toneClass, type Tone } from '@/theme';

/**
 * Port of AshaWorkerHomeAshaSathi.tsx.
 *
 * The web fills this page from `useAppStore` mock state. Everything here is read
 * from local SQLite so the numbers survive an offline start:
 *  - the four KPIs come from getDashboardKpis()
 *  - "High Risk Alerts" is derived from real high-risk patients, because there
 *    is no notifications table in the sync feed
 *  - "Today's Visits" is today's outstanding tasks; follow_ups is not a local
 *    table yet
 */

type CareModule = { label: string; path: string; icon: IconName; tone: Tone };

const CARE_MODULES: CareModule[] = [
  { label: 'asha.modAddPatient', path: '/register', icon: 'plus', tone: 'primary' },
  { label: 'asha.modHouseholds', path: '/households', icon: 'box', tone: 'secondary' },
  { label: 'asha.modHealthSurvey', path: '/health-survey', icon: 'edit', tone: 'tertiary' },
  { label: 'asha.modPregnancy', path: '/pregnancy', icon: 'heart', tone: 'primary' },
  { label: 'asha.modChildHealth', path: '/child-health', icon: 'users', tone: 'secondary' },
  { label: 'asha.modVaccination', path: '/child-health', icon: 'checkCircle', tone: 'tertiary' },
  { label: 'asha.modHealthCheckup', path: '/health-checkup', icon: 'activity', tone: 'primary' },
  { label: 'asha.modReferral', path: '/referrals', icon: 'fileText', tone: 'secondary' },
  { label: 'asha.modFollowUp', path: '/follow-ups', icon: 'refresh', tone: 'tertiary' },
  { label: 'asha.modTasks', path: '/tasks', icon: 'checkCircle', tone: 'secondary' },
  { label: 'asha.modNotifications', path: '/notifications', icon: 'bell', tone: 'error' },
  { label: 'asha.modSync', path: '/sync', icon: 'refresh', tone: 'secondary' },
];

function isDone(task: TaskWithPatient): boolean {
  return task.status === 'completed' || task.status === 'done';
}

export default function HomeScreen() {
  const { t, locale } = useLocalization();
  const router = useRouter();

  const [name, setName] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [tasks, setTasks] = useState<TaskWithPatient[]>([]);
  const [risky, setRisky] = useState<PatientRow[]>([]);
  const [online, setOnline] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);

  const load = useCallback(async () => {
    const [kpi, allTasks, highRisk, queue] = await Promise.all([
      getDashboardKpis(),
      listTasks('all'),
      listPatients({ risk: 'high' }),
      getQueueCounts().catch(() => ({ pending: 0, failed: 0 })),
    ]);
    setKpis(kpi);
    setTasks(allTasks);
    setRisky(highRisk);
    setPendingSync((queue.pending ?? 0) + (queue.failed ?? 0));
  }, []);

  useEffect(() => {
    void (async () => {
      const user = await tokenStore.getUser();
      setName(user?.full_name?.split(' ')[0] ?? '');
      setRole(user?.role ?? null);
    })();
    void load();
  }, [load]);

  // Returning to the tab (after a form, a sync, another screen) must not show
  // stale counts; the tab navigator keeps this screen mounted.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Coming back online means a push may have landed; refresh the counts.
  useEffect(() => subscribeOnline((value) => {
    setOnline(value);
    if (value) void load();
  }), [load]);

  // A sync finishing while this screen is open (post-login pull, Sync Now,
  // auto-retry) changes the numbers — reload when it lands.
  useEffect(() => subscribeSync((result) => {
    if (result) void load();
  }), [load]);

  // Admins land on the PHC dashboard, not the ASHA worker home; the tabs
  // underneath stay the same because their lists are already server-scoped.
  if (role === 'admin') {
    return <PhcDashboard />;
  }

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'asha.greetingMorning' : hour < 17 ? 'asha.greetingAfternoon' : 'asha.greetingEvening';
  const today = new Date().toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const stats: Array<{ label: string; value: string; hint: string; icon: IconName; tone: Tone }> = [
    { label: t('asha.agenda'), value: String(kpis?.todayAgenda ?? 0), hint: t('asha.visitsPlanned'), icon: 'activity', tone: 'primary' },
    { label: t('asha.pendingTasks'), value: String(kpis?.pendingTasks ?? 0), hint: t('asha.needAttention'), icon: 'checkCircle', tone: 'tertiary' },
    { label: t('asha.households'), value: String(kpis?.households ?? 0), hint: t('asha.underYourCare'), icon: 'users', tone: 'secondary' },
    { label: t('asha.highRisk'), value: String(kpis?.highRisk ?? 0), hint: t('asha.needMonitoring'), icon: 'alert', tone: 'error' },
  ];

  const pendingTasks = tasks.filter((task) => !isDone(task));
  const todaysVisits = pendingTasks.filter((task) => (task.task_date ?? '') <= new Date().toISOString().slice(0, 10));

  const toggle = async (task: TaskWithPatient) => {
    const next = !isDone(task);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, status: next ? 'completed' : 'pending' } : x)));
    try {
      await setTaskStatus(task, next);
      scheduleSync(400);
    } finally {
      void load();
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-28" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-caption text-caption font-medium text-on-surface-variant">{today}</Text>
            <Text
              className="font-headline-lg-bold text-headline-lg text-on-surface"
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {t(greetingKey, { name: name || '—' })}
            </Text>
          </View>
          <View className="flex-row shrink-0 items-center gap-2">
            {!online ? (
              <View className="flex-row items-center gap-1.5 rounded-full bg-error-container px-2.5 py-1.5">
                <View className="h-2 w-2 rounded-full bg-error" />
                <Text className="font-caption text-caption font-semibold text-on-error-container">
                  {t('nav.offline')}
                </Text>
                {pendingSync > 0 ? (
                  <View className="ml-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-error px-1">
                    <Text className="text-[10px] font-bold text-white">{pendingSync}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <LanguageToggle onSurface />
            <MoreButton />
          </View>
        </View>

        <View className="gap-3">
          {[0, 2].map((start) => (
            <View key={start} className="flex-row gap-3">
              {stats.slice(start, start + 2).map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </View>
          ))}
        </View>

        <View className="flex-row gap-3">
          <QuickAction
            icon="plus"
            label={t('asha.addPatient')}
            onPress={() => router.push('/register')}
            className="bg-primary"
            textClass="text-on-primary"
          />
          <QuickAction
            icon="edit"
            label={t('asha.recordVisit')}
            onPress={() => router.push('/households')}
            className="bg-primary"
            textClass="text-on-primary"
          />
          <QuickAction
            icon="alert"
            label={t('asha.emergency')}
            onPress={() => router.push('/connection-error')}
            className="bg-error"
            textClass="text-white"
          />
        </View>

        <View>
          <View className="mb-3 flex-row items-center gap-2">
            <Icon name="dashboard" size={20} />
            <Text className="font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.careModules')}</Text>
          </View>
          <View className="flex-row flex-wrap gap-3">
            {CARE_MODULES.map((module) => {
              const tone = toneClass(module.tone);
              return (
                <Pressable
                  key={module.label}
                  accessibilityRole="link"
                  accessibilityLabel={t(module.label)}
                  onPress={() => router.push(module.path as never)}
                  className="w-[31%] items-center gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-3 active:scale-95"
                  style={shadow.card}
                >
                  <View className={cx('h-11 w-11 items-center justify-center rounded-xl', tone.container, tone.onContainer)}>
                    <Icon name={module.icon} size={22} />
                  </View>
                  <Text className="text-center font-caption text-caption font-semibold leading-tight text-on-surface">
                    {t(module.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <View className="mb-3 flex-row items-center gap-2">
            <Icon name="alert" size={20} color={colors.error} />
            <Text className="font-headline-md text-headline-md font-semibold text-error">{t('asha.highRiskAlerts')}</Text>
          </View>
          {risky.length === 0 ? (
            <View className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6">
              <Text className="text-center font-body-md text-body-md text-on-surface-variant">{t('asha.noAlerts')}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pb-2">
              {risky.map((patient) => (
                <Pressable
                  key={patient.id}
                  accessibilityRole="button"
                  accessibilityLabel={t('asha.reviewNow')}
                  onPress={() => router.push(`/patient/${patient.id}` as never)}
                  className="w-[280px] max-w-[78vw] shrink-0 overflow-hidden rounded-2xl border border-error/20 bg-error-container p-4 pl-5 active:scale-[0.98]"
                >
                  <View className="absolute bottom-0 left-0 top-0 w-1.5 bg-error" />
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="rounded-full bg-error/10 px-2.5 py-1">
                      <Text className="font-caption text-caption font-semibold text-on-error-container">
                        {t('asha.alertBadge')}
                      </Text>
                    </View>
                    <Text className="font-caption text-caption text-on-error-container/80">
                      {patient.age_years != null ? `${patient.age_years}${t('asha.ageYearsShort')}` : ''}
                    </Text>
                  </View>
                  <Text className="mt-3 font-headline-md text-headline-md font-semibold text-on-error-container">
                    {patient.full_name}
                  </Text>
                  <Text className="font-body-md text-body-md text-on-error-container/80">
                    {[patient.beneficiary_id, patient.household_hhid].filter(Boolean).join(' · ')}
                  </Text>
                  <View className="mt-3 w-full items-center rounded-full bg-error px-4 py-2.5">
                    <Text className="font-label-md text-label-md font-semibold text-white">{t('asha.reviewNow')}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <View>
          <Text className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.todaysVisits')}</Text>
          {todaysVisits.length === 0 ? (
            <Card>
              <Text className="p-4 text-center font-body-md text-body-md text-on-surface-variant">{t('asha.noTasksHint')}</Text>
            </Card>
          ) : (
            <View className="gap-3">
              {todaysVisits.map((visit) => (
                <Card key={visit.id} rail="#1E6F5C" railWidth={6}>
                  <View className="flex-row items-center justify-between p-4 pl-5">
                    <View className="flex-1 flex-row items-center gap-3">
                      <View className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary-container">
                        <Icon name="heart" size={22} />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <View className="rounded-full bg-surface-container px-2 py-0.5">
                            <Text className="font-caption text-caption font-semibold text-on-surface-variant">
                              {visit.task_type ?? t('asha.agenda')}
                            </Text>
                          </View>
                          <Text className="font-caption text-caption text-on-surface-variant">
                            {visit.scheduled_time ?? visit.task_date}
                          </Text>
                        </View>
                        <Text className="mt-1 font-headline-md text-headline-md font-semibold text-on-surface">
                          {visit.patient_name ?? '—'}
                        </Text>
                        <View className="flex-row items-center gap-1">
                          <Icon name="mapPin" size={16} />
                          <Text className="font-body-md text-body-md text-on-surface-variant">
                            {visit.household_hhid ?? '—'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('asha.navigateTo', { name: visit.patient_name ?? '' })}
                      onPress={() => visit.beneficiary_id && router.push(`/patient/${visit.beneficiary_id}` as never)}
                      className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container active:scale-95"
                    >
                      <Icon name="activity" size={22} />
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>

        <View>
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.pendingTasks')}</Text>
            <Pressable accessibilityRole="link" onPress={() => router.push('/tasks')}>
              <Text className="font-label-md text-label-md font-semibold text-primary">{t('asha.viewAll')}</Text>
            </Pressable>
          </View>
          {pendingTasks.length === 0 ? (
            <Card>
              <Text className="p-4 text-center font-body-md text-body-md text-on-surface-variant">{t('asha.noTasksHint')}</Text>
            </Card>
          ) : (
            <View className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest" style={shadow.card}>
              {pendingTasks.map((task, index) => (
                <View
                  key={task.id}
                  className={cx('flex-row items-center justify-between gap-3 p-4', index < pendingTasks.length - 1 && 'border-b border-outline-variant/40')}
                >
                  <View className="flex-1 flex-row items-center gap-3">
                    <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary-container">
                      <Icon name="activity" size={20} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-label-md text-label-md font-semibold text-on-surface">
                        {task.task_type ?? t('asha.pendingTasks')}
                      </Text>
                      <Text numberOfLines={1} className="font-caption text-caption text-on-surface-variant">
                        {[task.patient_name, task.household_hhid].filter(Boolean).join(' · ') || '—'}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: false }}
                    accessibilityLabel={t('asha.markDone')}
                    onPress={() => void toggle(task)}
                    className="h-10 w-10 shrink-0 items-center justify-center rounded-full active:scale-90"
                  >
                    <Icon name="check" size={22} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  className,
  textClass,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  className: string;
  textClass: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={cx('flex-1 items-center gap-2 rounded-2xl px-2 py-3.5 active:scale-[0.97]', className)}
      style={shadow.card}
    >
      <Icon name={icon} size={28} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className={cx('text-center font-label-sm text-label-sm font-semibold leading-tight', textClass)}
      >
        {label}
      </Text>
    </Pressable>
  );
}
