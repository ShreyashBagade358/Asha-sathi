import { Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useLocalization } from '@/i18n/useLocalization';
import { colors, shadow } from '@/theme';

/** The day's target, matched to the web so both apps report the same progress. */
export const DAILY_TASK_QUOTA = 5;

export type ViewTask = {
  id: string;
  title: string;
  subtitle: string;
  done: boolean;
  due: string;
  priority: string;
  status: string;
  householdId?: string;
  householdHhid?: string;
  householdLabel: string;
  carriedFrom?: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * `2026-12-22` -> `22 Dec`.
 *
 * Built from the date parts rather than toLocaleDateString: Hermes only ships
 * the Intl data the app has bundled, and a locale-dependent format would also
 * change under the EN/hindi toggle for a value that is a date, not prose.
 */
export function formatDay(iso?: string): string {
  if (!iso) return '';
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return `${String(parsed.getDate()).padStart(2, '0')} ${MONTHS[parsed.getMonth()] ?? ''}`;
}

/**
 * Port of apps/web-dashboard/src/components/asha/DailyPlanCard.tsx: how much of
 * the day's quota is done, plus a badge for anything carried in from an earlier
 * day. The bar is measured against the quota rather than the task count so the
 * number keeps meaning when more work is assigned.
 */
export function DailyPlanCard({ tasks }: { tasks: ViewTask[] }) {
  const { t } = useLocalization();

  const done = tasks.filter((task) => task.done).length;
  const carried = tasks.filter((task) => task.carriedFrom);
  // Denominator tracks the actual plan (never the fixed quota alone) so the
  // header always agrees with the filter pills below it: an empty day reads
  // "0 of 0" next to All 0, not a quota the list does not have.
  const quota = tasks.length;
  const percent = quota > 0 ? Math.min(100, Math.round((done / quota) * 100)) : 0;

  return (
    <View
      className="mb-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4"
      style={shadow.card}
    >
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-container">
            <Icon name="calendar" size={20} color={colors.onPrimaryContainer} />
          </View>
          <View className="flex-1">
            <Text className="font-label-md text-label-md font-semibold text-on-surface">{t('asha.todaysVisits')}</Text>
            <Text className="font-caption text-caption text-on-surface-variant">
              {t('asha.visitsDoneOf', { done, quota })}
            </Text>
          </View>
        </View>
        {carried.length > 0 ? (
          <View className="rounded-full bg-tertiary-container px-2.5 py-1">
            <Text className="font-caption text-caption font-semibold text-on-tertiary-container">
              {t('asha.carriedOverCount', {
                count: carried.length,
                date: formatDay(carried[0]?.carriedFrom),
              })}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-surface-variant">
        <View className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </View>
    </View>
  );
}
