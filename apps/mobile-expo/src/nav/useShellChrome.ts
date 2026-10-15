import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { buildNotifications, getReadNotificationIds, subscribeNotificationRead } from '@/db/clinical';
import { subscribeSync } from '@/sync/network';

export type ShellChrome = {
  /** Unread notification count for the top bar's bell; 0 hides the badge. */
  badgeCount: number;
  onBadgePress: () => void;
  /** False for screens that render their own online/offline row. */
  showStatus: boolean;
};

export type ShellChromeOptions = {
  /**
   * Pass false on screens that own a status row (Sync Center's connectivity
   * chip, Connection Error's "Currently Offline" pill) so the top bar does not
   * print the same fact twice.
   */
  showStatus?: boolean;
};

/**
 * Top-bar chrome for screens rendered outside the tab navigator.
 *
 * The bell count is the same SQLite source the Notifications screen lists -
 * `buildNotifications()` minus the ids in `read_notifications` - so the badge
 * and the page can never disagree. Refreshes when a sync lands, when the app
 * returns to the foreground, and when the read set changes (the Notifications
 * screen marks rows read), because any of those can add or clear alerts.
 *
 * Usage (other screens are free to adopt this; it needs no per-screen wiring
 * beyond the three props):
 *
 *   const chrome = useShellChrome();
 *   <Screen badgeCount={chrome.badgeCount} onBadgePress={chrome.onBadgePress}
 *           showStatus={chrome.showStatus} …>
 */
export function useShellChrome(options: ShellChromeOptions = {}): ShellChrome {
  const { showStatus = true } = options;
  const router = useRouter();
  const [badgeCount, setBadgeCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [rows, read] = await Promise.all([buildNotifications(), getReadNotificationIds()]);
      setBadgeCount(rows.filter((row) => !read.has(row.id)).length);
    } catch {
      // The bell is decorative; a read failure must never break the screen.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const offSync = subscribeSync((result, working) => {
      if (!working) void refresh();
    });
    // A read on the Notifications screen is the only path that clears an alert
    // without a sync; without this the badge kept its stale count until the app
    // next hit the foreground.
    const offRead = subscribeNotificationRead(() => void refresh());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      offSync();
      offRead();
      sub.remove();
    };
  }, [refresh]);

  return {
    badgeCount,
    onBadgePress: useCallback(() => router.push('/notifications'), [router]),
    showStatus,
  };
}
