import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { tokenStore } from '@/auth/tokenStore';
import {
  getDashboardKpis,
  listPatients,
  listTasks,
  type DashboardKpis,
  type PatientRow,
  type TaskWithPatient,
} from '@/db/clinical';
import { Icon } from '@/components/ui/Icon';
import { StatCard } from '@/components/ui/StatCard';
import { LanguageToggle } from '@/components/LanguageToggle';
import { MoreButton } from '@/nav/MoreSheet';
import { useLocalization } from '@/i18n/useLocalization';
import { subscribeOnline, subscribeSync } from '@/sync/network';
import { colors } from '@/theme';

/**
 * Admin / PHC home.
 *
 * The tab shell is shared with the ASHA flow (the lists underneath are already
 * role-scoped by the server — an admin pulls the whole deployment), but the
 * landing content must not read as an ASHA worker's personal agenda. This
 * screen shows programme-level numbers instead: total beneficiaries, covered
 * households, outstanding work and the high-risk alert list.
 */
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

  // A sync landing (login pull, Sync Now) changes the numbers underneath.
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

  const stats: Array<{ label: string; value: number; hint?: string; icon: 'users' | 'box' | 'checkCircle' | 'alert'; tone: 'primary' | 'secondary' | 'tertiary' | 'error' }> = [
    { label: t('asha.patientsTitle'), value: patientCount, icon: 'users', tone: 'primary' },
    { label: t('phc.households'), value: kpis?.households ?? 0, icon: 'box', tone: 'secondary' },
    { label: t('asha.pendingTasks'), value: pending.length, icon: 'checkCircle', tone: 'tertiary' },
    { label: t('asha.highRisk'), value: risky.length, icon: 'alert', tone: 'error' },
  ];

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-28" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-caption text-caption font-medium text-on-surface-variant">{today}</Text>
            <Text className="mt-1 font-headline-lg-bold text-headline-lg text-on-surface">
              {t(greetingKey, { name: name || '—' })}
            </Text>
            <Text className="mt-1 font-body-md text-body-md text-on-surface-variant">
              {t('phc.dashboardSubtitle')}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {!online ? (
              <View className="flex-row items-center gap-1 rounded-full border border-outline-variant bg-surface-container-high px-3 py-1.5">
                <View className="h-2 w-2 rounded-full bg-outline" />
                <Text className="font-caption text-caption text-on-surface-variant">{t('nav.offline')}</Text>
              </View>
            ) : null}
            <LanguageToggle onSurface />
            <MoreButton />
          </View>
        </View>

        <View className="gap-3">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </View>

        <View>
          <View className="mb-3 flex-row items-center gap-2">
            <Icon name="alert" size={20} color={colors.error} />
            <Text className="font-headline-md text-headline-md font-semibold text-error">{t('phc.hrpAlertList')}</Text>
          </View>
          {risky.length === 0 ? (
            <View className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6">
              <Text className="text-center font-body-md text-body-md text-on-surface-variant">{t('asha.noAlerts')}</Text>
            </View>
          ) : (
            <View className="gap-3">
              {risky.slice(0, 8).map((patient) => (
                <View
                  key={patient.id}
                  className="overflow-hidden rounded-2xl border border-error/20 bg-error-container p-4 pl-5"
                >
                  <View className="absolute bottom-0 left-0 top-0 w-1.5 bg-error" />
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="font-headline-md text-headline-md font-semibold text-on-error-container">
                      {patient.full_name}
                    </Text>
                    <Text className="font-caption text-caption text-on-error-container/80">
                      {patient.age_years != null ? `${patient.age_years}${t('asha.ageYearsShort')}` : ''}
                    </Text>
                  </View>
                  <Text className="mt-1 font-body-sm text-body-sm text-on-error-container/80">
                    {patient.phone ?? ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
