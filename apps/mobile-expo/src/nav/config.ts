import type { IconName } from '@/components/ui/Icon';

/**
 * Navigation mirrors the ASHA sections in
 * apps/web-dashboard/src/components/layout/AdminLayout.tsx.
 *
 * The web splits its sidebar into sections and marks five items `bottomNav: true`
 * - home, tasks, patients, households, sync - which become the mobile tab bar.
 * The rest live behind a "More" sheet, exactly as they sit behind the overflow
 * menu on a narrow web viewport.
 *
 * Two deliberate differences from the web:
 *  - The web hardcodes nav badges (2 / 2 / 12 / 3). Mobile computes them from
 *    local SQLite via the `badge` selector, so they reflect real work.
 *  - Route paths drop the `/asha` prefix. The mobile app is ASHA-only (there is
 *    no role switcher), so `/asha/tasks` is just `/tasks`.
 */

export type NavBadge = 'pendingTasks' | 'outbox' | null;

export type NavItem = {
  /** Expo Router path. */
  path: string;
  /** i18n key, identical to the web's labelKey. */
  labelKey: string;
  icon: IconName;
  badge?: NavBadge;
  /** Danger tone, used for the sync outbox badge like the web's badgeTone. */
  badgeTone?: 'danger' | 'neutral';
};

export const BOTTOM_NAV: NavItem[] = [
  { path: '/', labelKey: 'nav.ashaHome', icon: 'dashboard' },
  { path: '/tasks', labelKey: 'nav.ashaTasks', icon: 'activity', badge: 'pendingTasks' },
  { path: '/patients', labelKey: 'nav.ashaPatients', icon: 'users' },
  { path: '/households', labelKey: 'nav.ashaHouseholds', icon: 'box' },
  { path: '/sync', labelKey: 'nav.ashaSync', icon: 'refresh', badge: 'outbox', badgeTone: 'danger' },
];

/** Everything the web exposes in the sidebar that is not a bottom-nav item. */
export const MORE_NAV: NavItem[] = [
  { path: '/health-survey', labelKey: 'nav.healthSurvey', icon: 'edit' },
  { path: '/pregnancy', labelKey: 'nav.pregnancyTracking', icon: 'heart' },
  { path: '/child-health', labelKey: 'nav.childHealth', icon: 'users' },
  { path: '/health-checkup', labelKey: 'nav.healthCheckup', icon: 'activity' },
  { path: '/referrals', labelKey: 'nav.referrals', icon: 'fileText' },
  { path: '/follow-ups', labelKey: 'nav.followUps', icon: 'checkCircle' },
  { path: '/notifications', labelKey: 'nav.notifications', icon: 'bell' },
  { path: '/profile', labelKey: 'nav.profile', icon: 'settings' },
];

export const ALL_NAV: NavItem[] = [...BOTTOM_NAV, ...MORE_NAV];

/** Web AdminLayout groups; used only for the "More" sheet section headings. */
export const MORE_SECTIONS: { titleKey: string; items: NavItem[] }[] = [
  { titleKey: 'nav.work', items: MORE_NAV.slice(0, 6) },
  { titleKey: 'nav.data', items: MORE_NAV.slice(6) },
];
