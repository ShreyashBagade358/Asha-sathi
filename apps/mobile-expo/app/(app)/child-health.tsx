import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { listChildrenWithParent, listGrowthRecords, type ChildWithParent } from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';
import type { GrowthRecord } from '@/db/clinical';

/**
 * Child Health, from the More menu.
 *
 * Reads the `children` table the app already syncs. Each row also loads that
 * child's most recent growth record, because weight/height/nutrition status is
 * what a field worker scans for; without a record the row shows the birth
 * details only rather than inventing a value.
 */
export default function ChildHealthScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const [rows, setRows] = useState<(ChildWithParent & { latest_growth: GrowthRecord | null })[]>([]);

  const load = useCallback(async () => {
    const children = await listChildrenWithParent();
    const withGrowth = await Promise.all(
      children.map(async (child) => {
        const records = await listGrowthRecords(child.id);
        return { ...child, latest_growth: records.at(-1) ?? null };
      }),
    );
    setRows(withGrowth);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen title={t('nav.childHealth')} subtitle={t('asha.childHealthSubtitle')} back withTabBar={false}>

        {rows.length === 0 ? (
          <EmptyState icon="users" title={t('common.noData')} />
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
                    <View className="flex-1">
                      <Text className="text-headline-md text-headline-md font-semibold text-on-surface" numberOfLines={1}>
                        {row.patient_name ?? '—'}
                      </Text>
                      {row.household_hhid ? (
                        <Text className="text-body-sm text-body-sm text-on-surface-variant">{row.household_hhid}</Text>
                      ) : null}
                    </View>

                    <View className="flex-row flex-wrap gap-x-6 gap-y-2">
                      {row.gestation_weeks != null ? (
                        <Meta label={t('asha.gestationWeeks')} value={`${row.gestation_weeks}`} />
                      ) : null}
                      {row.birth_weight_grams != null ? (
                        <Meta label={t('asha.birthWeight')} value={`${row.birth_weight_grams} ${t('asha.unitGrams')}`} />
                      ) : null}
                      {row.delivery_type ? <Meta label={t('asha.deliveryType')} value={row.delivery_type} /> : null}
                      {row.latest_growth?.weight_kg != null ? (
                        <Meta label={t('asha.weight')} value={`${row.latest_growth.weight_kg} ${t('asha.unitKg')}`} />
                      ) : null}
                      {row.latest_growth?.nutrition_status ? (
                        <Meta label={t('asha.nutritionStatus')} value={row.latest_growth.nutrition_status} />
                      ) : null}
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
