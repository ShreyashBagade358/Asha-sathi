import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, PageHeader } from '@/components/ui/Card';
import { Chip, chipToneColor, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SearchBar } from '@/components/ui/SearchBar';
import { listHouseholdCards, type HouseholdCard } from '@/db/clinical';
import { getQueueCounts } from '@/db/database';
import { useLocalization } from '@/i18n/useLocalization';
import { LanguageToggle } from '@/components/LanguageToggle';
import { MoreButton } from '@/nav/MoreSheet';
import { subscribeOnline } from '@/sync/network';
import { colors } from '@/theme';
import { cx } from '@/cx';

/**
 * Port of AssignedHouseholdsAshaSathi.tsx plus the mock's three CTA states.
 *
 * The web reads a household's status off a mock row. Here every card value is
 * derived from local SQLite - open tasks decide Start Visit vs Planned, closed
 * tasks decide Review Record, and pregnancies decide the pregnant chip - so the
 * list is still correct on a phone that has never reached the server.
 */

type FilterKey = 'all' | 'planned' | 'visited' | 'pregnant';
type Cta = 'visit' | 'review' | 'planned';

const FILTERS: FilterKey[] = ['all', 'planned', 'visited', 'pregnant'];
const FILTER_LABEL: Record<FilterKey, string> = {
  all: 'asha.filterAll',
  planned: 'asha.filterPlanned',
  visited: 'asha.filterVisited',
  pregnant: 'asha.filterPregnant',
};

const STATUS: Record<Cta, { labelKey: string; tone: ChipTone; icon: IconName; rail: string }> = {
  visit: { labelKey: 'asha.visitDue', tone: 'error', icon: 'alert', rail: '#BA1A1A' },
  review: { labelKey: 'asha.followUp', tone: 'success', icon: 'checkCircle', rail: '#006E28' },
  planned: { labelKey: 'asha.scheduled', tone: 'neutral', icon: 'calendar', rail: '#727783' },
};

function ctaFor(household: HouseholdCard, today: string): Cta {
  if (household.open_tasks === 0 && household.completed_tasks > 0) return 'review';
  if (household.next_task_date && household.next_task_date > today) return 'planned';
  return 'visit';
}

function matchesFilter(household: HouseholdCard, filter: FilterKey, today: string): boolean {
  switch (filter) {
    case 'planned':
      return ctaFor(household, today) === 'planned';
    case 'visited':
      return household.completed_tasks > 0;
    case 'pregnant':
      return household.pregnant > 0;
    default:
      return true;
  }
}

export default function HouseholdsScreen() {
  const { t } = useLocalization();
  const router = useRouter();
  const [rows, setRows] = useState<HouseholdCard[] | null>(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async () => {
    const [cards, counts] = await Promise.all([listHouseholdCards(), getQueueCounts()]);
    setRows(cards);
    setPending(counts.pending + counts.failed);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribeOnline(setOnline), []);

  const today = new Date().toISOString().slice(0, 10);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (household) =>
        matchesFilter(household, filter, today) &&
        (needle === '' ||
          [household.hhid, household.head_name, household.address].some((value) =>
            String(value ?? '').toLowerCase().includes(needle),
          )),
    );
  }, [rows, query, filter, today]);

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="px-4 pb-28"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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

        {!online ? (
          <View className="mb-4 flex-row items-center justify-center gap-2 rounded-xl bg-surface-container px-3 py-2.5">
            <Icon name="wifiOff" size={16} />
            <Text className="font-label-md text-label-md text-on-surface-variant">
              {t('asha.offlinePending', { count: pending })}
            </Text>
          </View>
        ) : null}

        <View className="gap-3">
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={t('asha.householdSearchPlaceholder')}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          <View className="flex-row flex-wrap gap-2">
            {FILTERS.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === key }}
                accessibilityLabel={t(FILTER_LABEL[key])}
                onPress={() => setFilter(key)}
                hitSlop={4}
                className={cx('rounded-full', filter === key ? undefined : 'opacity-70')}
              >
                <Chip
                  tone={filter === key ? 'info' : 'neutral'}
                  size="md"
                  icon={
                    filter === key ? (
                      <Icon name="check" size={12} color={chipToneColor.info} />
                    ) : undefined
                  }
                >
                  {t(FILTER_LABEL[key])}
                </Chip>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mt-4 gap-4">
          {rows === null ? (
            <EmptyState icon="inbox" title={t('common.loading')} />
          ) : visible.length === 0 ? (
            rows.length === 0 ? (
              <EmptyState
                icon="users"
                title={t('asha.householdsEmpty')}
                description={t('asha.householdsEmptyHint')}
                actionLabel={t('asha.addHousehold')}
                onActionPress={() => router.push('/register?mode=household')}
              />
            ) : (
              <EmptyState icon="search" title={t('common.noResults')} />
            )
          ) : (
            visible.map((household) => {
              const cta = ctaFor(household, today);
              const status = STATUS[cta];
              return (
                <HouseholdCardRow
                  key={household.id}
                  household={household}
                  cta={cta}
                  rail={status.rail}
                  onOpen={() => router.push(`/household/${household.id}`)}
                  onStartVisit={() => router.push(`/household/${household.id}/visit`)}
                  statusLabel={t(status.labelKey)}
                  statusTone={status.tone}
                  statusIcon={status.icon}
                  today={today}
                />
              );
            })
          )}
        </View>
      </ScrollView>

      <FAB
        onPress={() => router.push('/register?mode=household')}
        accessibilityLabel={t('asha.addHousehold')}
      />
    </View>
  );
}

function HouseholdCardRow({
  household,
  cta,
  rail,
  statusLabel,
  statusTone,
  statusIcon,
  today,
  onOpen,
  onStartVisit,
}: {
  household: HouseholdCard;
  cta: Cta;
  rail: string;
  statusLabel: string;
  statusTone: ChipTone;
  statusIcon: IconName;
  today: string;
  onOpen: () => void;
  onStartVisit: () => void;
}) {
  const { t } = useLocalization();

  const meta =
    cta === 'planned' && household.next_task_date
      ? t('asha.nextVisit', { day: household.next_task_date })
      : cta === 'review' && household.last_visit_date
        ? t('asha.lastVisit', { days: daysAgo(household.last_visit_date, today) })
        : null;

  return (
    <Card rail={rail} className={cx(cta === 'planned' && 'opacity-75')}>
      <View className="gap-2 p-5 pl-8">
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-headline-md text-headline-md font-semibold text-on-surface" numberOfLines={1}>
              {household.head_name || household.hhid || '—'}
            </Text>
            <View className="flex-row items-center gap-1">
              <Icon name="users" size={16} />
              <Text className="font-body-md text-body-md text-on-surface-variant">
                {t('asha.familySize', { count: household.members })}
              </Text>
            </View>
          </View>
          <Chip tone={statusTone} size="md" icon={<Icon name={statusIcon} size={12} color={chipToneColor[statusTone]} />}>
            {statusLabel}
          </Chip>
        </View>

        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
          {household.hhid ? (
            <Text className="font-caption text-caption text-on-surface-variant">{household.hhid}</Text>
          ) : null}
          <View className="min-w-0 flex-1 flex-row items-center gap-1">
            <Icon name="mapPin" size={14} />
            <Text className="font-body-md text-body-md text-on-surface-variant" numberOfLines={1}>
              {household.address ?? '—'}
            </Text>
          </View>
        </View>

        <View className="flex-row flex-wrap items-center gap-2">
          {household.pregnant > 0 ? (
            <Chip
              tone="success"
              icon={<Icon name="heart" size={12} color={chipToneColor.success} />}
            >
              {t('asha.pregnantCount', { count: household.pregnant })}
            </Chip>
          ) : null}
          {household.children_under5 > 0 ? (
            <Chip tone="info">{t('asha.childrenUnder5', { count: household.children_under5 })}</Chip>
          ) : null}
          {meta ? <Text className="font-caption text-caption text-on-surface-variant">{meta}</Text> : null}
        </View>
      </View>

      <View className="p-5 pt-0 pl-8">
        {cta === 'visit' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('asha.startVisit')}
            onPress={onStartVisit}
            className="h-12 w-full flex-row items-center justify-center gap-2 rounded-full bg-primary shadow-sm active:scale-95"
          >
            <Icon name="activity" size={18} color={colors.onPrimary} />
            <Text className="font-label-md text-label-md font-bold text-on-primary">{t('asha.startVisit')}</Text>
          </Pressable>
        ) : cta === 'review' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('asha.reviewRecord')}
            onPress={onOpen}
            className="h-12 w-full flex-row items-center justify-center gap-2 rounded-full border-2 border-primary active:scale-95"
          >
            <Icon name="eye" size={18} color={colors.primary} />
            <Text className="font-label-md text-label-md font-bold text-primary">{t('asha.reviewRecord')}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            accessibilityLabel={t('asha.planned')}
            disabled
            onPress={onOpen}
            className="h-12 w-full flex-row items-center justify-center gap-2 rounded-full bg-surface-container"
          >
            <Icon name="calendar" size={18} color={colors.onSurfaceVariant} />
            <Text className="font-label-md text-label-md font-semibold text-on-surface-variant">
              {t('asha.planned')}
            </Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

function daysAgo(date: string, today: string): number {
  const then = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(then) || Number.isNaN(now)) return 0;
  return Math.max(0, Math.round((now - then) / 86_400_000));
}
