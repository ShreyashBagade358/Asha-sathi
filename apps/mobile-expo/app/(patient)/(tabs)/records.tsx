import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Card, PageHeader, Pill } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/LoadingState';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';
import { MoreButton } from '@/nav/MoreSheet';
import { PATIENT_MORE_SECTIONS } from '@/nav/config';
import {
  buildHealthRecords,
  loadLocalChildren,
  loadLocalPregnancy,
  type LocalChildSummary,
  type LocalPregnancySummary,
} from '@/patient/records';
import { colors } from '@/theme';
import type { HealthRecord, HealthRecordCategory } from '@/patient/types';
import { shareText } from '@/utils/share';

type TabKey = 'all' | HealthRecordCategory;

const TAB_META: Record<HealthRecordCategory, { label: string; icon: IconName; tone: string }> = {
  checkup: { label: 'patient.tabCheckups', icon: 'activity', tone: 'bg-primary-container' },
  prescription: { label: 'patient.tabPrescriptions', icon: 'edit', tone: 'bg-secondary-container' },
  lab: { label: 'patient.tabLabReports', icon: 'fileText', tone: 'bg-tertiary-fixed' },
};

type RecordsState = {
  records: HealthRecord[];
  pregnancy: LocalPregnancySummary | null;
  children: LocalChildSummary[];
};

/**
 * Health Records, ported from the web's PatientHealthRecordsPage: pregnancy /
 * child summary cards on top, category filter pills, then the record cards.
 * Data comes from local SQLite (see records.ts), so the list works offline.
 * Prescriptions and lab reports stay empty until an offline source exists —
 * the same honest emptiness the web store shows.
 */
export default function PatientRecordsScreen() {
  const { t } = useLocalization();
  const [data, setData] = useState<RecordsState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [filter, setFilter] = useState<TabKey>('all');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [records, pregnancy, children] = await Promise.all([
        buildHealthRecords(),
        loadLocalPregnancy(),
        loadLocalChildren(),
      ]);
      setData({ records, pregnancy, children });
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const records = data?.records ?? [];
  const pregnancy = data?.pregnancy ?? null;
  const children = data?.children ?? [];

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: records.length },
    {
      key: 'checkup',
      label: t('patient.tabCheckups'),
      count: records.filter((r) => r.category === 'checkup').length,
    },
    {
      key: 'prescription',
      label: t('patient.tabPrescriptions'),
      count: records.filter((r) => r.category === 'prescription').length,
    },
    {
      key: 'lab',
      label: t('patient.tabLabReports'),
      count: records.filter((r) => r.category === 'lab').length,
    },
  ];

  const visible = records.filter((r) => (filter === 'all' ? true : r.category === filter));
  const hasSummary = Boolean(pregnancy) || children.length > 0;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-36"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title={t('patient.recordsTitle')}
          subtitle={t('patient.recordsSubtitle')}
          actions={
            <>
              <LanguageToggle onSurface />
              <MoreButton sections={PATIENT_MORE_SECTIONS} />
            </>
          }
        />

        {status === 'failed' ? (
          <ErrorState message={t('common.errorMsg')} onRetry={() => void load()} />
        ) : status === 'loading' ? (
          <LoadingState />
        ) : (
          <>
            {hasSummary ? (
              <View className="mb-6 gap-3">
                {pregnancy ? (
                  <View className="rounded-2xl border border-primary/20 bg-primary-container/30 p-4">
                    <View className="mb-2 flex-row items-center gap-2">
                      <Icon name="heart" size={18} color={colors.primary} />
                      <Text className="text-label-md text-label-md font-semibold text-on-surface">
                        {t('patient.pregnancySummary')}
                      </Text>
                    </View>
                    <View className="flex-row flex-wrap gap-3">
                      {[
                        {
                          label: t('patient.trimester'),
                          value: pregnancy.trimester != null ? String(pregnancy.trimester) : '—',
                        },
                        {
                          label: t('patient.week'),
                          value: pregnancy.week != null ? String(pregnancy.week) : '—',
                        },
                        { label: t('patient.edd'), value: pregnancy.edd },
                        { label: t('patient.ancVisits'), value: String(pregnancy.ancVisits) },
                        { label: t('patient.lmp'), value: pregnancy.lmp },
                        { label: t('asha.riskHighLabel'), value: pregnancy.risk },
                      ].map((cell) => (
                        <View key={cell.label} className="w-[46%] grow">
                          <Text className="text-caption text-caption text-on-surface-variant">
                            {cell.label}
                          </Text>
                          <Text className="text-label-md text-label-md font-semibold text-on-surface">
                            {cell.value}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {children.length > 0 ? (
                  <View className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
                    <View className="mb-2 flex-row items-center gap-2">
                      <Icon name="heart" size={18} color={colors.secondary} />
                      <Text className="text-label-md text-label-md font-semibold text-on-surface">
                        {t('asha.childHealthTitle')}
                      </Text>
                    </View>
                    <View className="gap-2">
                      {children.map((child) => (
                        <View
                          key={child.id}
                          className="flex-row items-center justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-2.5"
                        >
                          <View className="min-w-0 flex-1">
                            <Text
                              className="text-label-md text-label-md font-semibold text-on-surface"
                              numberOfLines={1}
                            >
                              {child.label}
                            </Text>
                            <Text className="text-caption text-caption text-on-surface-variant">
                              {child.subtitle ? `${child.subtitle} · ` : ''}
                              {t('asha.immunization')}
                            </Text>
                          </View>
                          <Text className="text-caption text-caption font-semibold text-on-surface-variant">
                            {child.done}/{child.doses.length}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View className="mb-4 flex-row flex-wrap gap-2">
              {tabs.map((tab) => (
                <Pill
                  key={tab.key}
                  label={tab.label}
                  count={tab.count}
                  active={filter === tab.key}
                  onPress={() => setFilter(tab.key)}
                />
              ))}
            </View>

            {visible.length === 0 ? (
              <Card>
                <Text className="p-6 text-center text-body-md text-body-md text-on-surface-variant">
                  {t('patient.noRecords')}
                </Text>
              </Card>
            ) : (
              <View className="gap-3">
                {visible.map((record) => {
                  const meta = TAB_META[record.category];
                  return (
                    <Card key={record.id} className="overflow-hidden">
                      <View className="flex-row items-start justify-between gap-3 p-4">
                        <View className="min-w-0 flex-1 flex-row items-center gap-3">
                          <View
                            className={cx(
                              'h-11 w-11 shrink-0 items-center justify-center rounded-full',
                              meta.tone,
                            )}
                          >
                            <Icon name={meta.icon} size={22} />
                          </View>
                          <View className="min-w-0 flex-1">
                            <Text
                              className="text-label-md text-label-md font-semibold text-on-surface"
                              numberOfLines={1}
                            >
                              {record.title}
                            </Text>
                            <Text
                              className="text-caption text-caption text-on-surface-variant"
                              numberOfLines={1}
                            >
                              {record.date} · {record.facility}
                              {record.doctor ? ` · ${record.doctor}` : ''}
                            </Text>
                          </View>
                        </View>
                        {record.downloadable ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('common.download')}
                            hitSlop={8}
                            onPress={() =>
                              void shareText(
                                record.title,
                                [
                                  record.title,
                                  `${record.date} · ${record.facility}${record.doctor ? ` · ${record.doctor}` : ''}`,
                                  ...record.details.map(
                                    (detail) => `${detail.label}: ${detail.value}`,
                                  ),
                                  ...(record.dose
                                    ? [`${t('patient.prescriptionDose')}: ${record.dose}`]
                                    : []),
                                ].join('\n'),
                              )
                            }
                            className="h-10 w-10 items-center justify-center"
                          >
                            <Icon name="download" size={20} color={colors.primary} />
                          </Pressable>
                        ) : null}
                      </View>

                      {record.details.length > 0 ? (
                        <View className="flex-row flex-wrap border-t border-outline-variant/40 bg-surface-container-low/50">
                          {record.details.map((detail) => (
                            <View
                              key={detail.label}
                              className="w-[48%] grow border-b border-r border-outline-variant/40 bg-surface-container-lowest px-4 py-3"
                            >
                              <Text className="text-caption text-caption uppercase text-on-surface-variant">
                                {detail.label}
                              </Text>
                              <Text className="mt-0.5 text-body-md text-body-md font-semibold text-on-surface">
                                {detail.value}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {record.dose ? (
                        <View className="flex-row flex-wrap gap-x-6 gap-y-1 border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-3">
                          <Text className="text-caption text-caption text-on-surface-variant">
                            {t('patient.prescriptionDose')}:{' '}
                            <Text className="font-semibold text-on-surface">{record.dose}</Text>
                          </Text>
                          {record.duration ? (
                            <Text className="text-caption text-caption text-on-surface-variant">
                              {t('patient.prescriptionDuration')}:{' '}
                              <Text className="font-semibold text-on-surface">
                                {record.duration}
                              </Text>
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
