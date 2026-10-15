import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { ApiError } from '@/auth/api';
import { Screen } from '@/components/Screen';
import { Card, SectionHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/LoadingState';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';
import { getMyHousehold } from '@/patient/api';
import type { MyHousehold, MyHouseholdMember } from '@/patient/types';
import { colors } from '@/theme';
import { relationshipLabel } from '@/utils/relationship';

function relationOf(member: MyHouseholdMember, t: (key: string) => string): string {
  const relation = relationshipLabel(member.relationshipToHead, t);
  if (member.isSelf) return `${relation} · ${t('patient.you')}`;
  return relation;
}

function ageText(member: MyHouseholdMember, t: (key: string) => string): string {
  if (typeof member.ageYears === 'number') return `${member.ageYears} ${t('patient.years')}`;
  if (typeof member.ageMonths === 'number') return `${member.ageMonths} ${t('patient.months')}`;
  return '—';
}

/**
 * The signed-in patient's family, ported from web `PatientFamilyPage` on top of
 * `GET /patients/me/household`: a household summary card followed by every
 * registered member.
 *
 * A profile with no linked household renders as an empty state rather than an
 * error — self-registered patients genuinely have no family row yet, and a red
 * banner would blame them for it.
 */
export default function PatientFamilyScreen() {
  const { t } = useLocalization();
  const [household, setHousehold] = useState<MyHousehold | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notLinked' | 'failed'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setHousehold(await getMyHousehold());
      setStatus('ready');
    } catch (error) {
      setHousehold(null);
      setStatus(error instanceof ApiError && error.status === 404 ? 'notLinked' : 'failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen
      title={t('patient.familyTitle')}
      subtitle={t('patient.familySubtitle')}
      back
      withTabBar={false}
    >
      {status === 'loading' ? (
        <LoadingState />
      ) : status === 'failed' ? (
        <ErrorState message={t('common.errorMsg')} onRetry={() => void load()} />
      ) : status === 'notLinked' || !household ? (
        <EmptyState
          icon="users"
          title={t('patient.noHousehold')}
          description={t('patient.noHouseholdHint')}
          actionLabel={t('common.retry')}
          onActionPress={() => void load()}
        />
      ) : (
        <View className="gap-4">
          <Card>
            <View className="flex-row items-start justify-between gap-3 p-4">
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-caption font-semibold uppercase text-on-surface-variant">
                  {t('asha.householdIdLabel')}
                </Text>
                <Text className="font-headline-md text-headline-md font-semibold text-on-surface">
                  {household.householdId}
                </Text>
              </View>
              <View className="shrink-0 rounded-full bg-secondary-container px-3 py-1">
                <Text className="text-caption font-semibold text-on-secondary-container">
                  {t('patient.familySizeCount', {
                    count: household.familySize ?? household.memberCount,
                  })}
                </Text>
              </View>
            </View>

            <View className="gap-2 border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-3">
              <View className="flex-row items-center gap-2">
                <Icon name="users" size={18} color={colors.outline} />
                <Text className="min-w-0 flex-1 text-body-md text-on-surface">
                  <Text className="font-semibold">{t('patient.headOfHousehold')}: </Text>
                  {household.headName || '—'}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Icon name="mapPin" size={18} color={colors.outline} />
                <Text
                  className="min-w-0 flex-1 text-body-md text-on-surface-variant"
                  numberOfLines={2}
                >
                  {[household.address, household.village, household.ward]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </Text>
              </View>
            </View>
          </Card>

          <SectionHeader
            title={t('patient.familyTitle')}
            action={
              <View className="rounded-full bg-surface-container-high px-3 py-1">
                <Text className="text-caption font-semibold text-on-surface">
                  {household.memberCount} {t('asha.members')}
                </Text>
              </View>
            }
          />

          {household.members.length === 0 ? (
            <Card>
              <Text className="p-6 text-center text-body-md text-on-surface-variant">
                {t('asha.noMembersRecorded')}
              </Text>
            </Card>
          ) : (
            <View className="gap-3">
              {household.members.map((member) => (
                <Card key={member.id}>
                  <View className="flex-row items-center justify-between gap-3 p-4">
                    <View className="min-w-0 flex-1 flex-row items-center gap-3">
                      <View
                        className={cx(
                          'h-11 w-11 shrink-0 items-center justify-center rounded-full',
                          member.isPregnant
                            ? 'bg-tertiary-container text-on-tertiary-container'
                            : 'bg-surface-container-high text-primary',
                        )}
                      >
                        <Icon
                          name={member.isPregnant ? 'heart' : 'users'}
                          size={20}
                          color={colors.primary}
                        />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="text-body-md font-bold text-on-surface" numberOfLines={1}>
                          {member.fullName}
                        </Text>
                        <Text className="text-caption text-on-surface-variant" numberOfLines={1}>
                          {member.gender ?? '—'}, {ageText(member, t)} · {relationOf(member, t)}
                        </Text>
                      </View>
                    </View>
                    <View className="shrink-0 items-end gap-1">
                      {member.isSelf ? (
                        <View className="rounded-full bg-primary px-2.5 py-1">
                          <Text className="text-caption font-semibold text-on-primary">
                            {t('patient.you')}
                          </Text>
                        </View>
                      ) : null}
                      {member.isPregnant ? (
                        <View className="rounded-full bg-tertiary-container px-2.5 py-1">
                          <Text className="text-caption font-semibold text-on-tertiary-container">
                            {t('asha.highRisk')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
