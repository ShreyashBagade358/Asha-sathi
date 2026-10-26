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
  /**
   * In-page action instead of navigation. When set, MoreSheet calls this
   * (after closing) rather than router.push — used for "Edit Profile" which
   * opens a modal on the health-profile screen.
   */
  onPress?: () => void;
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

/** Web AdminLayout groups; used only for the "More" sheet section headings. */
export const MORE_SECTIONS: { titleKey: string; items: NavItem[] }[] = [
  { titleKey: 'nav.work', items: MORE_NAV.slice(0, 6) },
  { titleKey: 'nav.data', items: MORE_NAV.slice(6) },
];

/**
 * Patient shell, mirroring the `patient` section of AdminLayout.tsx:
 * five `bottomNav: true` items (home, health-profile, records, vaccination,
 * settings) become the tab bar, the rest sit behind the same More sheet.
 *
 * Paths drop the `/patient` prefix the same way the ASHA routes drop `/asha`,
 * except where a bare path would collide with an ASHA route the shell already
 * owns (`/referrals`, `/notifications`, `/profile`): those three become
 * `/my-referrals`, `/my-notifications` and `/settings` so Expo Router never
 * has to pick between two files for one URL.
 */
export const PATIENT_BOTTOM_NAV: NavItem[] = [
  { path: '/home', labelKey: 'nav.patientHome', icon: 'dashboard' },
  { path: '/health-profile', labelKey: 'nav.patientProfile', icon: 'heart' },
  { path: '/records', labelKey: 'nav.patientRecords', icon: 'fileText' },
  { path: '/vaccination', labelKey: 'nav.patientVaccination', icon: 'checkCircle' },
  { path: '/settings', labelKey: 'nav.patientSettings', icon: 'settings' },
];

/** Web `bottomNav: false` patient items — More-sheet entries. */
export const PATIENT_MORE_NAV: NavItem[] = [
  { path: '/family', labelKey: 'nav.patientFamily', icon: 'users' },
  { path: '/appointments', labelKey: 'nav.patientAppointments', icon: 'calendar' },
  { path: '/my-referrals', labelKey: 'nav.patientReferrals', icon: 'activity' },
  { path: '/my-follow-ups', labelKey: 'nav.followUps', icon: 'checkCircle' },
  { path: '/my-notifications', labelKey: 'nav.patientNotifications', icon: 'bell' },
];

/** The patient More sheet has one flat section; the web sidebar does not group it. */
export const PATIENT_MORE_SECTIONS: { titleKey: string; items: NavItem[] }[] = [
  { titleKey: 'nav.more', items: PATIENT_MORE_NAV },
];

/**
 * Signed-out routes. They are reached from the auth flow rather than from any
 * menu, and are listed so the route-parity test can account for them.
 */
export const PUBLIC_NAV: Record<string, string> = {
  '/login': 'app/index redirect, logout, session expiry',
  '/verify-otp': 'login OTP flow, account-recovery success state',
  '/account-recovery': 'login "forgot password", verify-otp help link',
};

/**
 * Routes that are deliberately NOT menu entries, with the surface that does
 * expose them. Anything a screen reaches through its own flow (a detail page
 * opened from a list, a confirmation page at the end of a form) belongs here
 * rather than in MORE_NAV: the web does not list `/asha/patient/:id` in the
 * sidebar either.
 *
 * Keep this map in sync with `app/` - `__tests__/shell-routes.test.tsx` fails
 * when a route file has no entry in BOTTOM_NAV, MORE_NAV, PUBLIC_NAV or here.
 */
export const CONTEXT_NAV: Record<string, string> = {
  '/register': 'Home care modules, Patients / Households empty states and FABs',
  '/patient/[id]': 'Patients list, pregnancy / child-health / referral / check-up rows, Home alerts',
  '/patient/[id]/immunization': 'Patient detail "Immunization" row',
  '/patient/[id]/profile': 'Patient detail "Health Profile" row',
  '/household/[id]': 'Households list card',
  '/household/[id]/visit': 'Household card "Start Visit", tasks due row',
  '/checkup-completed': 'Health check-up submit success (Agent 3C)',
  '/new-checkup': 'Health check-up screen "New Check-up" FAB',
  '/connection-error': 'Home "Emergency" quick action, OfflineBanner tap',
};
