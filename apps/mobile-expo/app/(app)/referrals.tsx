import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Card, Pill } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { listReferralsWithPatient, type ReferralWithPatient } from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';

/**
 * Referrals, from the More menu.
 *
 * `referrals` is one of the tables the app syncs, so this is a real list. The
 * seed data has none, which is why the empty state is the web's
 * "No referrals found" copy rather than a generic placeholder.
 */
export default function ReferralsScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const [rows, setRows] = useState<ReferralWithPatient[]>([]);

  const load = useCallback(async () => {
    setRows(await listReferralsWithPatient());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen title={t('nav.referrals')} subtitle={t('asha.referralSubtitle')} back withTabBar={false}>

        {rows.length === 0 ? (
          <EmptyState icon="fileText" title={t('patient.noReferrals')} />
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
                      <Text className="flex-1 text-headline-md text-headline-md font-semibold text-on-surface" numberOfLines={1}>
                        {row.patient_name ?? '—'}
                      </Text>
                      <Pill
                        label={
                          row.urgency === 'emergency'
                            ? t('patient.emergency')
                            : row.urgency === 'urgent'
                              ? t('patient.urgent')
                              : t('patient.routine')
                        }
                        active={row.urgency === 'emergency'}
                      />
                    </View>

                    <View className="gap-1">
                      <Text className="text-caption text-caption text-on-surface-variant">{t('patient.refReason')}</Text>
                      <Text className="text-body-md text-body-md text-on-surface">{row.reason ?? '—'}</Text>
                    </View>

                    <View className="flex-row flex-wrap gap-x-6 gap-y-2">
                      <Meta label={t('common.status')} value={row.status ?? '—'} />
                      {row.referred_to_facility_id ? (
                        <Meta label={t('asha.referredTo')} value={row.referred_to_facility_id} />
                      ) : null}
                      {row.initiated_at ? <Meta label={t('common.date')} value={row.initiated_at} /> : null}
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
