import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatCard } from '@/components/ui/StatCard';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';
import { MoreButton } from '@/nav/MoreSheet';
import { PATIENT_MORE_SECTIONS } from '@/nav/config';
import { colors } from '@/theme';
import { listAppointments } from '@/patient/appointments';
import { buildHealthRecords, loadLocalChildren } from '@/patient/records';
import { usePatientProfile } from '@/patient/profile';
import type { Appointment, HealthRecord } from '@/patient/types';
import { shareText } from '@/utils/share';

type QuickAction = { label: string; path: string; icon: IconName; tone: string };

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'patient.viewProfile',
    path: '/health-profile',
    icon: 'heart',
    tone: 'bg-primary-container text-on-primary-container',
  },
  {
    label: 'patient.viewRecords',
    path: '/records',
    icon: 'fileText',
    tone: 'bg-secondary-container text-on-secondary-container',
  },
  {
    label: 'patient.viewVaccination',
    path: '/vaccination',
    icon: 'checkCircle',
    tone: 'bg-tertiary-container text-on-tertiary-container',
  },
  {
    label: 'patient.bookAppointment',
    path: '/appointments',
    icon: 'calendar',
    tone: 'bg-primary-container text-on-primary-container',
  },
];

function greeting(
  firstName: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const hour = new Date().getHours();
  if (hour < 12) return t('patient.greetingMorning', { name: firstName });
  if (hour < 17) return t('patient.greetingAfternoon', { name: firstName });
  return t('patient.greetingEvening', { name: firstName });
}

type HomeSummary = {
  appointments: Appointment[];
  records: HealthRecord[];
  dosesDone: number;
  dosesTotal: number;
};

/**
 * Patient dashboard, ported from the web's PatientHomePage.
 *
 * The four stat cards, quick actions and the two lists read the same sources
 * the web's store did — appointments / healthRecords / childVaccines — mapped
 * here to the local SQLite lists (see src/patient/records.ts) plus the API
 * profile, so the page renders fully offline.
 */
export default function PatientHomeScreen() {
  const { t } = useLocalization();
  const router = useRouter();
  const profile = usePatientProfile();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [appointments, records, children] = await Promise.all([
        listAppointments(),
        buildHealthRecords(),
        loadLocalChildren(),
      ]);
      const doses = children.flatMap((child) => child.doses);
      setSummary({
        appointments,
        records,
        dosesDone: doses.filter((dose) => dose.status === 'given').length,
        dosesTotal: doses.length,
      });
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const firstName = (profile.display.name || '').split(' ')[0] || t('common.welcome');
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const upcoming = summary?.appointments.filter((a) => a.status === 'upcoming') ?? [];
  const nextAppointment = upcoming[0];
  const labReports = summary?.records.filter((r) => r.category === 'lab') ?? [];
  const recordsCount = summary?.records.length ?? 0;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-36"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-caption text-caption font-medium text-on-surface-variant">
              {today}
            </Text>
            <Text
              className="font-headline-lg-bold text-headline-lg text-on-surface"
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {greeting(firstName, t)}
            </Text>
            <Text className="font-body-md text-body-md text-on-surface-variant">
              {t('patient.homeSubtitle')}
            </Text>
          </View>
          <View className="flex-row shrink-0 items-center gap-2 pt-1">
            <LanguageToggle onSurface />
            <MoreButton sections={PATIENT_MORE_SECTIONS} />
          </View>
        </View>

        {status === 'failed' ? (
          <ErrorState message={t('common.errorMsg')} onRetry={() => void load()} />
        ) : status === 'loading' ? (
          <LoadingState />
        ) : (
          <>
            <View className="mb-6 flex-row flex-wrap gap-3">
              {[
                {
                  label: t('patient.nextAppointment'),
                  value: nextAppointment ? (nextAppointment.date.split(' ')[0] ?? '—') : '—',
                  hint: nextAppointment
                    ? `${nextAppointment.type} · ${nextAppointment.time}`
                    : t('patient.noUpcoming'),
                  icon: 'calendar' as const,
                  tone: 'primary' as const,
                },
                {
                  label: t('patient.viewRecords'),
                  value: String(recordsCount),
                  hint: t('patient.recordsTitle'),
                  icon: 'fileText' as const,
                  tone: 'secondary' as const,
                },
                {
                  label: t('patient.viewVaccination'),
                  value: `${summary?.dosesDone ?? 0}/${summary?.dosesTotal ?? 0}`,
                  hint: t('patient.dosesCompleted', {
                    done: summary?.dosesDone ?? 0,
                    total: summary?.dosesTotal ?? 0,
                  }),
                  icon: 'checkCircle' as const,
                  tone: 'tertiary' as const,
                },
                {
                  label: t('patient.healthAtGlance'),
                  value: profile.display.latestBp,
                  hint: t('patient.latestBp'),
                  icon: 'heart' as const,
                  tone: 'error' as const,
                },
              ].map((stat) => (
                <View key={stat.label} className="w-[48%] grow self-stretch">
                  <StatCard {...stat} />
                </View>
              ))}
            </View>

            <View className="mb-6">
              <View className="mb-3 flex-row items-center gap-2">
                <Icon name="activity" size={20} color={colors.primary} />
                <Text className="font-headline-md text-headline-md font-semibold text-on-surface">
                  {t('patient.quickActions')}
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-3">
                {QUICK_ACTIONS.map((action) => (
                  <Pressable
                    key={action.path}
                    accessibilityRole="button"
                    accessibilityLabel={t(action.label)}
                    onPress={() => router.push(action.path as never)}
                    className="w-[48%] grow items-center justify-center gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4"
                  >
                    <View
                      className={cx(
                        'h-11 w-11 items-center justify-center rounded-xl',
                        action.tone,
                      )}
                    >
                      <Icon name={action.icon} size={22} />
                    </View>
                    <Text className="text-center text-caption text-caption font-semibold leading-tight text-on-surface">
                      {t(action.label)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="mb-6">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="font-headline-md text-headline-md font-semibold text-on-surface">
                  {t('patient.upcomingAppointments')}
                </Text>
                <Pressable accessibilityRole="link" onPress={() => router.push('/appointments')}>
                  <Text className="text-label-md text-label-md font-semibold text-primary">
                    {t('patient.viewAll')}
                  </Text>
                </Pressable>
              </View>
              {upcoming.length > 0 ? (
                <View className="gap-3">
                  {upcoming.map((appointment) => (
                    <Pressable
                      key={appointment.id}
                      accessibilityRole="button"
                      onPress={() => router.push('/appointments')}
                    >
                      <Card>
                        <View className="flex-row items-center gap-3 p-4">
                          <View className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container">
                            <Icon name="calendar" size={22} />
                          </View>
                          <View className="min-w-0 flex-1">
                            <Text
                              className="text-label-md text-label-md font-semibold text-on-surface"
                              numberOfLines={1}
                            >
                              {appointment.type}
                            </Text>
                            <View className="flex-row items-center gap-1">
                              <Icon name="mapPin" size={13} />
                              <Text
                                className="text-caption text-caption text-on-surface-variant"
                                numberOfLines={1}
                              >
                                {appointment.location}
                              </Text>
                            </View>
                          </View>
                          <View className="items-end">
                            <Text className="text-label-md text-label-md font-semibold text-on-surface">
                              {appointment.date}
                            </Text>
                            <Text className="text-caption text-caption text-on-surface-variant">
                              {appointment.time}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Card>
                  <Text className="p-6 text-center text-body-md text-body-md text-on-surface-variant">
                    {t('patient.noUpcoming')}
                  </Text>
                </Card>
              )}
            </View>

            {/*
              The web always renders the Latest Reports box; lab reports have no
              offline source yet (see records.ts), and an empty bordered box
              tells the patient nothing, so the section appears only once a
              report exists.
            */}
            {labReports.length > 0 ? (
              <View>
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="font-headline-md text-headline-md font-semibold text-on-surface">
                    {t('patient.latestReports')}
                  </Text>
                  <Pressable accessibilityRole="link" onPress={() => router.push('/records')}>
                    <Text className="text-label-md text-label-md font-semibold text-primary">
                      {t('patient.viewAll')}
                    </Text>
                  </Pressable>
                </View>
                <Card>
                  {labReports.map((report) => (
                    <View
                      key={report.id}
                      className="flex-row items-center justify-between gap-3 p-4"
                    >
                      <View className="min-w-0 flex-1 flex-row items-center gap-3">
                        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high">
                          <Icon name="fileText" size={20} />
                        </View>
                        <View className="min-w-0">
                          <Text
                            className="text-label-md text-label-md font-semibold text-on-surface"
                            numberOfLines={1}
                          >
                            {report.title}
                          </Text>
                          <Text
                            className="text-caption text-caption text-on-surface-variant"
                            numberOfLines={1}
                          >
                            {report.date} · {report.facility}
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('common.download')}
                        hitSlop={8}
                        onPress={() =>
                          void shareText(
                            report.title,
                            [
                              report.title,
                              `${report.date} · ${report.facility}`,
                              ...report.details.map((detail) => `${detail.label}: ${detail.value}`),
                            ].join('\n'),
                          )
                        }
                        className="h-10 w-10 items-center justify-center"
                      >
                        <Icon name="download" size={20} color={colors.primary} />
                      </Pressable>
                    </View>
                  ))}
                </Card>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
