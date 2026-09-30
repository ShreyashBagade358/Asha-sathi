import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RiskChip } from '@/components/ui/Button';
import { listPregnanciesWithPatient, type PregnancyWithPatient } from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';

/**
 * Pregnancy Tracking, from the More menu.
 *
 * Backed by the `pregnancies` table the app already syncs, joined to the
 * beneficiary name in SQL (listPregnanciesWithPatient). Tapping a row opens the
 * same patient detail screen the Patients tab uses, so there is one clinical
 * record view rather than a second implementation.
 */
export default function PregnancyTrackingScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const [rows, setRows] = useState<PregnancyWithPatient[]>([]);

  const load = useCallback(async () => {
    setRows(await listPregnanciesWithPatient());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen title={t('nav.pregnancyTracking')} subtitle={t('asha.pregnancySubtitle')} back withTabBar={false}>

        {rows.length === 0 ? (
          <EmptyState icon="heart" title={t('asha.notPregnant')} />
        ) : (
          <View className="gap-3">
            {rows.map((row) => (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                onPress={() => router.push(`/patient/${row.beneficiary_id}`)}
              >
                <Card>
                  <View className="gap-3 p-4">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-headline-md text-headline-md font-semibold text-on-surface" numberOfLines={1}>
                          {row.patient_name ?? '—'}
                        </Text>
                        {row.household_hhid ? (
                          <Text className="text-body-sm text-body-sm text-on-surface-variant">{row.household_hhid}</Text>
                        ) : null}
                      </View>
                      <RiskChip
                        level={(row.risk_level as 'low' | 'medium' | 'high') ?? 'low'}
                        label={
                          row.risk_level === 'high'
                            ? t('asha.riskHighLabel')
                            : row.risk_level === 'medium'
                              ? t('asha.riskMediumLabel')
                              : t('asha.riskLowLabel')
                        }
                      />
                    </View>

                    <View className="flex-row flex-wrap gap-x-6 gap-y-2">
                      <Meta label={t('asha.edd')} value={row.edd ?? '—'} />
                      <Meta label={t('asha.ancVisits')} value={row.anc_count ?? 0} />
                      <Meta label={t('asha.nextAncDue')} value={row.next_anc_due ?? '—'} />
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
    </Screen>
  );
}

function Meta({ label, value }: { label: string; value: string | number }) {
  return (
    <View>
      <Text className="text-caption text-caption text-on-surface-variant">{label}</Text>
      <Text className="text-body-md text-body-md font-semibold text-on-surface">{value}</Text>
    </View>
  );
}
