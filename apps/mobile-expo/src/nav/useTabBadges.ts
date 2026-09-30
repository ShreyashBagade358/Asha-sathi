import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getQueueCounts } from '@/db/database';
import { getDashboardKpis } from '@/db/clinical';
import { subscribeSync } from '@/sync/network';
import type { TabBadges } from '@/nav/TabBar';

/**
 * Live counts for the two tab badges.
 *
 * The web hardcodes 2 / 12 / 3 in AdminLayout's nav definitions. Here the values
 * are real: outstanding tasks from `asha_tasks`, and the depth of the sync
 * outbox (pending + failed) so the danger-toned sync badge matches what the Sync
 * Center page would show.
 *
 * Refreshes when a sync completes, when the app returns to the foreground, and
 * on mount, so a task completed on another screen updates the bar.
 */
export function useTabBadges(): TabBadges {
  const [badges, setBadges] = useState<TabBadges>({ pendingTasks: 0, outbox: 0 });

  const refresh = useCallback(async () => {
    try {
      const [counts, kpis] = await Promise.all([getQueueCounts(), getDashboardKpis()]);
      setBadges({
        pendingTasks: kpis.pendingTasks,
        outbox: (counts.pending ?? 0) + (counts.failed ?? 0),
      });
    } catch {
      // A badge is cosmetic; never let a read failure break navigation.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const offSync = subscribeSync((result) => {
      if (result) void refresh();
    });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      offSync();
      sub.remove();
    };
  }, [refresh]);

  return badges;
}
