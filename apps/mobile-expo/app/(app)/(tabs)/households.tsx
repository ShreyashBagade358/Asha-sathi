import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Card, PageHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { listHouseholdsWithCounts, type HouseholdWithCounts } from '@/db/clinical';
import { useLocalization } from '@/i18n/useLocalization';
import { LanguageToggle } from '@/components/LanguageToggle';
import { MoreButton } from '@/nav/MoreSheet';

/**
 * Port of AssignedHouseholdsAshaSathi.tsx, including its three-state status
 * config. The web reads that status off a mock row; here it is derived from the
 * household's real outstanding tasks, so "Visit due" genuinely means an overdue
 * or today task exists rather than a hardcoded string.
 *
 * The web's card also shows headName / lastVisitDays / nextVisit from the mock.
 * Only `hhid`, `address`, member count, open-task count and the next task date
 * come down the sync feed, so those are what the card renders.
 */
type Status = {
  labelKey: string;
  chip: string;
  icon: IconName;
  accent: string;
};

function statusFor(household: HouseholdWithCounts, today: string): Status {
  if (household.open_tasks === 0) {
    return { labelKey: 'asha.scheduled', chip: 'bg-surface-container', icon: 'calendar', accent: '#727783' };
  }
  if (household.next_task_date && household.next_task_date > today) {
    return { labelKey: 'asha.scheduled', chip: 'bg-surface-container', icon: 'calendar', accent: '#727783' };
  }
  return { labelKey: 'asha.visitDue', chip: 'bg-error-container', icon: 'alert', accent: '#BA1A1A' };
}

export default function HouseholdsScreen() {
  const { t } = useLocalization();
  const [households, setHouseholds] = useState<HouseholdWithCounts[]>([]);

  const load = useCallback(async () => {
    setHouseholds(await listHouseholdsWithCounts());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-4 pb-28" showsVerticalScrollIndicator={false}>
        <PageHeader
          title={t('asha.assignedHouseholds')}
          subtitle={t('asha.householdsSubtitle')}
          actions={
            <>
              <LanguageToggle onSurface />
              <MoreButton />
            </>
          }
        />

        {households.length === 0 ? (
          <EmptyState title={t('asha.assignedHouseholds')} description={t('asha.householdsSubtitle')} />
        ) : (
          <View className="gap-4">
            {households.map((household) => {
              const status = statusFor(household, today);
              return (
                <Card key={household.id} rail={status.accent}>
                  <View className="gap-2 p-5 pl-8">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="font-headline-md text-headline-md font-semibold text-on-surface">
                          {household.hhid ?? '—'}
                        </Text>
                        <View className="flex-row items-center gap-1">
                          <Icon name="users" size={16} />
                          <Text className="font-body-md text-body-md text-on-surface-variant">
                            {t('asha.familySize', { count: household.members })}
                          </Text>
                        </View>
                      </View>
                      <View className={`flex-row items-center gap-1 self-start rounded-full px-3 py-1 ${status.chip}`}>
                        <Icon name={status.icon} size={14} />
                        <Text className="font-caption text-caption font-bold text-on-surface-variant">
                          {t(status.labelKey)}
                        </Text>
                      </View>
                    </View>

                    <View className="mt-1 gap-0.5 font-body-md text-body-md text-on-surface-variant">
                      {household.address ? <Text>{household.address}</Text> : null}
                      {household.next_task_date ? (
                        <Text>{t('asha.nextVisit', { day: household.next_task_date })}</Text>
                      ) : null}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
