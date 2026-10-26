import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/LoadingState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';
import { MoreButton } from '@/nav/MoreSheet';
import { PATIENT_MORE_SECTIONS } from '@/nav/config';
import { loadLocalChildren, type LocalChildSummary } from '@/patient/records';
import type { DoseStatus, VaccineDose } from '@/patient/types';
import { shareText } from '@/utils/share';

const DOSE_META: Record<DoseStatus, { label: string; icon: IconName; tone: string; text: string }> =
  {
    given: {
      label: 'patient.doseGiven',
      icon: 'checkCircle',
      tone: 'bg-secondary-container',
      text: 'text-on-secondary-container',
    },
    due: {
      label: 'patient.doseDue',
      icon: 'calendar',
      tone: 'bg-tertiary-container',
      text: 'text-on-tertiary-container',
    },
    overdue: {
      label: 'patient.doseOverdue',
      icon: 'alert',
      tone: 'bg-error-container',
      text: 'text-on-error-container',
    },
    upcoming: {
      label: 'patient.doseUpcoming',
      icon: 'calendar',
      tone: 'bg-surface-container-high',
      text: 'text-on-surface-variant',
    },
  };

type VaccinationState = {
  child: LocalChildSummary | undefined;
  childDoses: VaccineDose[];
  childDone: number;
};

function DoseRow({ dose, compact = false }: { dose: VaccineDose; compact?: boolean }) {
  const { t } = useLocalization();
  const meta = DOSE_META[dose.status];

  return (
    <View
      className={cx(
        'flex-row items-center justify-between gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4',
        dose.status === 'due' && 'border-tertiary',
      )}
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-3">
        <View
          className={cx(
            'shrink-0 items-center justify-center rounded-full',
            compact ? 'h-9 w-9' : 'h-10 w-10',
            meta.tone,
          )}
        >
          <Icon name={meta.icon} size={compact ? 18 : 20} />
        </View>
        <View className="min-w-0 flex-1">
          <Text
            className="text-label-md text-label-md font-semibold text-on-surface"
            numberOfLines={1}
          >
            {dose.name}
          </Text>
          <Text className="text-caption text-caption text-on-surface-variant" numberOfLines={1}>
            {dose.vaccines}
          </Text>
        </View>
      </View>
      <View className="shrink-0 items-end">
        <Text className={cx('text-[11px] font-bold leading-4', meta.text)}>{t(meta.label)}</Text>
        <Text className="mt-0.5 text-caption text-caption text-on-surface-variant">
          {dose.date}
        </Text>
      </View>
    </View>
  );
}

/**
 * Vaccination, ported from the web's PatientVaccinationPage: the child
 * immunization card with its progress bar, the dose list, then the patient's
 * own immunization card. Doses come from the locally synced `immunizations`
 * rows (see records.ts), so the page works offline; the "your immunization"
 * list stays empty until a maternal-dose source exists — exactly what the web
 * store renders today.
 */
export default function PatientVaccinationScreen() {
  const { t } = useLocalization();
  const [data, setData] = useState<VaccinationState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const children = await loadLocalChildren();
      const child = children[0];
      const childDoses = children.flatMap((row) => row.doses);
      setData({
        child,
        childDoses,
        childDone: childDoses.filter((dose) => dose.status === 'given').length,
      });
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const done = data?.childDone ?? 0;
  const total = data?.childDoses.length ?? 0;
  const progress = total > 0 ? done / total : 0;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-36"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title={t('patient.vaccinationTitle')}
          subtitle={
            data?.child ? t('patient.vaccinationSubtitle') : t('patient.noChildrenRegistered')
          }
          actions={
            <>
              {data?.child ? (
                <Button
                  label={t('patient.vaccineCertificate')}
                  icon="download"
                  variant="secondary"
                  shape="pill"
                  onPress={() =>
                    void shareText(
                      t('patient.vaccineCertificate'),
                      [
                        t('patient.vaccinationTitle'),
                        ...(data?.childDoses ?? []).map(
                          (dose) =>
                            `${dose.name} · ${dose.date} · ${t(DOSE_META[dose.status].label)}`,
                        ),
                      ].join('\n'),
                    )
                  }
                />
              ) : null}
              <LanguageToggle onSurface />
              <MoreButton sections={PATIENT_MORE_SECTIONS} />
            </>
          }
        />

        {status === 'failed' ? (
          <ErrorState message={t('common.errorMsg')} onRetry={() => void load()} />
        ) : status === 'loading' ? (
          <LoadingState />
        ) : !data?.child ? (
          <EmptyState
            title={t('patient.noChildrenRegistered')}
            description={t('patient.vaccinationSubtitle')}
          />
        ) : (
          <>
            <Card className="mb-6 p-5">
              <View className="mb-4 flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-secondary-container">
                  <Icon name="heart" size={22} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-headline-md text-headline-md font-semibold text-on-surface">
                    {t('patient.childImmunization')}
                  </Text>
                  <Text
                    className="text-caption text-caption text-on-surface-variant"
                    numberOfLines={1}
                  >
                    {data.child.label} · {data.child.subtitle}
                  </Text>
                </View>
              </View>
              <Text className="mb-1.5 text-caption text-caption text-on-surface-variant">
                {done}/{total} · {Math.round(progress * 100)}%
              </Text>
              <ProgressBar value={progress} tone="secondary" />
            </Card>

            <View className="mb-6 gap-3">
              {data.childDoses.length === 0 ? (
                <Card>
                  <Text className="p-6 text-center text-body-md text-body-md text-on-surface-variant">
                    {t('patient.noRecords')}
                  </Text>
                </Card>
              ) : (
                data.childDoses.map((dose) => <DoseRow key={dose.id} dose={dose} />)
              )}
            </View>

            <Card className="p-5">
              <View className="mb-4 flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-container">
                  <Icon name="shield" size={22} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-headline-md text-headline-md font-semibold text-on-surface">
                    {t('patient.yourImmunization')}
                  </Text>
                  <Text className="text-caption text-caption text-on-surface-variant">
                    {t('patient.dosesCompleted', { done: 0, total: 0 })}
                  </Text>
                </View>
              </View>
              <Text className="text-center text-body-md text-body-md text-on-surface-variant">
                {t('patient.noRecords')}
              </Text>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
