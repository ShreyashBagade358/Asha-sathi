import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { StatusChip } from 'asha-design-system'
import { useAuth } from '@/hooks/useAuth'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore, type Toast } from '@/stores/ui.store'
import { Icon, type IconName } from '@/components/common/Icons'
import { SearchModal } from '@/components/layout/SearchModal'
import { ProfilePanel } from '@/components/layout/ProfilePanel'
import type { Role } from '@/types'

const HEADER_ICON_BUTTON =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-on-surface transition-colors hover:bg-surface-container active:scale-[0.97]'

interface NavItem {
  labelKey: string
  path: string
  icon: IconName
  end?: boolean
  badge?: number
  badgeTone?: 'neutral' | 'danger'
  bottomNav?: boolean
}

interface NavSection {
  titleKey?: string
  items: NavItem[]
}

const NAV_SECTIONS: Record<string, NavSection[]> = {
  asha: [
    {
      titleKey: 'nav.work',
      items: [
        { labelKey: 'nav.ashaHome', path: '/asha/home', icon: 'dashboard', end: true, bottomNav: true },
        { labelKey: 'nav.ashaTasks', path: '/asha/tasks', icon: 'activity', badge: 2, bottomNav: true },
      ],
    },
    {
      titleKey: 'nav.care',
      items: [
        { labelKey: 'nav.ashaHouseholds', path: '/asha/households', icon: 'box', badge: 2, bottomNav: true },
        { labelKey: 'nav.healthSurvey', path: '/asha/health-survey', icon: 'edit', bottomNav: false },
        { labelKey: 'nav.pregnancyTracking', path: '/asha/pregnancy', icon: 'heart', bottomNav: false },
        { labelKey: 'nav.childHealth', path: '/asha/child-health', icon: 'heart', bottomNav: false },
        { labelKey: 'nav.healthCheckup', path: '/asha/health-checkup', icon: 'activity', bottomNav: false },
        { labelKey: 'nav.referrals', path: '/asha/referrals', icon: 'fileText', bottomNav: false },
        { labelKey: 'nav.followUps', path: '/asha/follow-ups', icon: 'checkCircle', bottomNav: false },
      ],
    },
    {
      titleKey: 'nav.people',
      items: [{ labelKey: 'nav.ashaPatients', path: '/asha/patients', icon: 'users', bottomNav: true }],
    },
    {
      titleKey: 'nav.data',
      items: [
        { labelKey: 'nav.ashaSync', path: '/asha/sync', icon: 'refresh', badge: 12, badgeTone: 'danger', bottomNav: true },
        { labelKey: 'nav.notifications', path: '/asha/notifications', icon: 'bell', badge: 3, bottomNav: false },
        { labelKey: 'nav.profile', path: '/asha/profile', icon: 'settings', bottomNav: false },
      ],
    },
  ],
  phc: [
    {
      items: [
        { labelKey: 'nav.dashboard', path: '/phc/dashboard', icon: 'dashboard', end: true },
        { labelKey: 'nav.ashas', path: '/phc/ashas', icon: 'users' },
        { labelKey: 'nav.beneficiaries', path: '/phc/beneficiaries', icon: 'heart' },
        { labelKey: 'nav.reports', path: '/phc/reports', icon: 'fileText' },
        { labelKey: 'nav.alerts', path: '/phc/alerts', icon: 'alert' },
      ],
    },
  ],
  district: [
    {
      items: [
        { labelKey: 'nav.dashboard', path: '/district/dashboard', icon: 'dashboard', end: true },
        { labelKey: 'nav.phcComparison', path: '/district/phc-comparison', icon: 'barChart' },
        { labelKey: 'nav.resourceAllocation', path: '/district/resources', icon: 'box' },
      ],
    },
  ],
  state: [
    {
      items: [
        { labelKey: 'nav.dashboard', path: '/state/dashboard', icon: 'dashboard', end: true },
        { labelKey: 'nav.districtComparison', path: '/state/district-comparison', icon: 'barChart' },
      ],
    },
    {
      titleKey: 'nav.administration',
      items: [
        { labelKey: 'nav.policyConfig', path: '/state/policy-config', icon: 'fileText' },
        { labelKey: 'nav.auditLogs', path: '/state/audit-logs', icon: 'shield' },
      ],
    },
  ],
  super: [
    {
      items: [
        { labelKey: 'nav.userManagement', path: '/super/users', icon: 'users', end: true },
        { labelKey: 'nav.systemConfig', path: '/super/system-config', icon: 'settings' },
        { labelKey: 'nav.deployment', path: '/super/deployment', icon: 'server' },
      ],
    },
  ],
  patient: [
    {
      titleKey: 'nav.main',
      items: [
        { labelKey: 'nav.patientHome', path: '/patient/dashboard', icon: 'dashboard', end: true, bottomNav: true },
        { labelKey: 'nav.patientProfile', path: '/patient/health-profile', icon: 'heart', bottomNav: true },
        { labelKey: 'nav.patientRecords', path: '/patient/records', icon: 'fileText', bottomNav: true },
      ],
    },
    {
      titleKey: 'nav.care',
      items: [
        { labelKey: 'nav.patientVaccination', path: '/patient/vaccination', icon: 'checkCircle', bottomNav: true },
        { labelKey: 'nav.patientAppointments', path: '/patient/appointments', icon: 'calendar', bottomNav: false },
        { labelKey: 'nav.patientReferrals', path: '/patient/referrals', icon: 'activity', bottomNav: false },
      ],
    },
    {
      titleKey: 'nav.data',
      items: [
        { labelKey: 'nav.patientNotifications', path: '/patient/notifications', icon: 'bell', badge: 3, bottomNav: false },
        { labelKey: 'nav.patientSettings', path: '/patient/profile', icon: 'settings', bottomNav: true },
      ],
    },
  ],
}

const ROLE_SECTIONS: Record<Role, string[]> = {
  asha: ['asha'],
  anm: ['phc'],
  moic: ['phc'],
  bpm: ['phc'],
  dpm: ['district'],
  state_admin: ['state'],
  super_admin: ['super', 'state', 'district', 'phc'],
  patient: ['patient'],
}

const SAMPLE_NOTIFICATIONS = [
  { id: 'n1', tone: 'danger' as const, title: 'HRP escalation', message: 'Sunita Devi (Rampur) BP 160/100' },
  { id: 'n2', tone: 'warning' as const, title: 'Stockout alert', message: 'Inj. Oxytocin below threshold at PHC' },
  { id: 'n3', tone: 'info' as const, title: 'Sync failure', message: 'ASHA Saroj Yadav failed to sync' },
]

interface BreadcrumbDef {
  labelKey: string
  to?: string
}

function getBreadcrumbDefs(pathname: string): BreadcrumbDef[] | null {
  if (/^\/asha\/patients\/new$/.test(pathname)) {
    return [{ labelKey: 'nav.ashaPatients', to: '/asha/patients' }, { labelKey: 'nav.newPatient' }]
  }
  if (/^\/asha\/patients\/[^/]+\/profile$/.test(pathname)) {
    return [{ labelKey: 'nav.ashaPatients', to: '/asha/patients' }, { labelKey: 'nav.healthProfile' }]
  }
  if (/^\/asha\/patients\/[^/]+\/immunization$/.test(pathname)) {
    return [{ labelKey: 'nav.ashaPatients', to: '/asha/patients' }, { labelKey: 'nav.immunization' }]
  }
  if (/^\/asha\/patients\/[^/]+$/.test(pathname)) {
    return [{ labelKey: 'nav.ashaPatients', to: '/asha/patients' }, { labelKey: 'nav.patientDetails' }]
  }
  if (/^\/asha\/households\/[^/]+\/visit$/.test(pathname)) {
    return [{ labelKey: 'nav.ashaHouseholds', to: '/asha/households' }, { labelKey: 'nav.visitSurvey' }]
  }
  if (pathname === '/asha/checkup-completed') {
    return [{ labelKey: 'nav.checkupCompleted' }]
  }
  if (pathname === '/asha/health-survey') {
    return [{ labelKey: 'nav.healthSurvey' }]
  }
  if (pathname === '/asha/pregnancy') {
    return [{ labelKey: 'nav.pregnancyTracking' }]
  }
  if (pathname === '/asha/child-health') {
    return [{ labelKey: 'nav.childHealth' }]
  }
  if (pathname === '/asha/health-checkup') {
    return [{ labelKey: 'nav.healthCheckup' }]
  }
  if (pathname === '/asha/referrals') {
    return [{ labelKey: 'nav.referrals' }]
  }
  if (pathname === '/asha/follow-ups') {
    return [{ labelKey: 'nav.followUps' }]
  }
  if (pathname === '/asha/notifications') {
    return [{ labelKey: 'nav.notifications' }]
  }
  if (pathname === '/asha/profile') {
    return [{ labelKey: 'nav.profile' }]
  }
  if (pathname === '/patient/health-profile') {
    return [{ labelKey: 'nav.patientHome', to: '/patient/dashboard' }, { labelKey: 'nav.patientProfile' }]
  }
  if (pathname === '/patient/records') {
    return [{ labelKey: 'nav.patientHome', to: '/patient/dashboard' }, { labelKey: 'nav.patientRecords' }]
  }
  if (pathname === '/patient/vaccination') {
    return [{ labelKey: 'nav.patientHome', to: '/patient/dashboard' }, { labelKey: 'nav.patientVaccination' }]
  }
  if (pathname === '/patient/appointments') {
    return [{ labelKey: 'nav.patientHome', to: '/patient/dashboard' }, { labelKey: 'nav.patientAppointments' }]
  }
  if (pathname === '/patient/referrals') {
    return [{ labelKey: 'nav.patientHome', to: '/patient/dashboard' }, { labelKey: 'nav.patientReferrals' }]
  }
  if (pathname === '/patient/notifications') {
    return [{ labelKey: 'nav.patientHome', to: '/patient/dashboard' }, { labelKey: 'nav.patientNotifications' }]
  }
  if (pathname === '/patient/profile') {
    return [{ labelKey: 'nav.patientHome', to: '/patient/dashboard' }, { labelKey: 'nav.patientSettings' }]
  }
  return null
}

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function AdminLayout() {
  const { t } = useLocalization()
  const { user, logout } = useAuth()
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed } = useUIStore()
  const navigate = useNavigate()
  const location = useLocation()
  const online = useOnlineStatus()
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname, setSidebarOpen])

  const sections = useMemo(() => {
    const scope = user ? ROLE_SECTIONS[user.role] ?? [] : []
    return scope.flatMap((key) => NAV_SECTIONS[key] ?? [])
  }, [user])

  const currentTitleKey = useMemo(() => {
    for (const section of sections) {
      for (const item of section.items) {
        if (item.end ? location.pathname === item.path : location.pathname.startsWith(item.path)) {
          return item.labelKey
        }
      }
    }
    return 'common.appName'
  }, [sections, location.pathname])

  const breadcrumbs = useMemo(() => {
    const defs = getBreadcrumbDefs(location.pathname)
    if (!defs) return null
    return defs.map((d) => ({ label: t(d.labelKey), to: d.to }))
  }, [location.pathname, t])

  const title = breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : t(currentTitleKey)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        sections={sections}
        userName={user?.fullName ?? ''}
        userRole={user?.role ?? 'asha'}
        subtitle={user?.role === 'patient' ? 'Patient App' : 'ASHA Worker App'}
        village={user?.villages?.[0] ?? ''}
        online={online}
        onOpenProfile={() => setProfileOpen(true)}
        onLogout={handleLogout}
      />
      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-200 ${
          sidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-[264px]'
        }`}
      >
        <TopAppBar
          title={title}
          breadcrumbs={breadcrumbs}
          online={online}
          onMenuClick={() => setSidebarOpen(true)}
          onOpenProfile={() => setProfileOpen(true)}
          onLogout={handleLogout}
        />
        <main className={`flex-1 px-5 py-6 desktop:px-8 ${user?.role === 'asha' || user?.role === 'patient' ? 'pb-24 lg:pb-8' : ''}`}>
          <Outlet />
        </main>
      </div>
      {user?.role === 'asha' || user?.role === 'patient' ? <MobileBottomNav sections={sections} /> : null}
      <ProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} onLogout={handleLogout} />
      <ToastContainer />
    </div>
  )
}

function Sidebar({
  open,
  onClose,
  collapsed,
  sections,
  userName,
  userRole,
  village,
  online,
  onOpenProfile,
  onLogout,
  subtitle,
}: {
  open: boolean
  onClose: () => void
  collapsed: boolean
  sections: NavSection[]
  userName: string
  userRole: Role
  village: string
  online: boolean
  onOpenProfile: () => void
  onLogout: () => void
  subtitle: string
}) {
  const { t } = useLocalization()
  const { toggleSidebarCollapsed } = useUIStore()
  const initials = userName.charAt(0).toUpperCase() || '?'

  const content = (
    <div className="flex h-full flex-col bg-primary text-on-primary">
      <div className={`flex items-center gap-3 py-3 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
          <Icon name="heart" size={22} />
        </div>
        {!collapsed ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-md font-bold leading-tight">{t('common.appName')}</p>
              <p className="truncate text-label-md text-primary-fixed-dim">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              aria-label={t('nav.collapse')}
              title={t('nav.collapse')}
              className="ml-auto hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-primary-fixed-dim transition-colors hover:bg-primary/40 hover:text-white lg:flex"
            >
              <Icon name="chevronLeft" size={18} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            aria-label={t('nav.collapse')}
            title={t('nav.collapse')}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-primary-fixed-dim transition-colors hover:bg-primary/40 hover:text-white lg:flex"
          >
            <Icon name="chevronRight" size={18} />
          </button>
        )}
      </div>

      {!collapsed && village ? (
        <div className="mx-4 mb-0 flex items-center gap-1.5 rounded-full bg-primary/40 px-3 py-1 text-label-md text-primary-fixed-dim">
          <Icon name="mapPin" size={14} />
          <span className="truncate">{village}</span>
          <span className={`ml-auto h-2 w-2 shrink-0 rounded-full ${online ? 'bg-secondary-container' : 'bg-error'}`} />
        </div>
      ) : null}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-1">
        {sections.map((section, idx) => (
          <div key={idx}>
            {section.titleKey && !collapsed ? (
              <p className="px-3 pb-0 pt-1 text-label-md uppercase tracking-wide text-primary-fixed-dim">
                {t(section.titleKey)}
              </p>
            ) : null}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const label = t(item.labelKey)
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.end}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        `relative flex items-center gap-3 rounded-lg py-1.5 text-body-md font-medium transition-colors ${
                          collapsed ? 'justify-center px-0' : 'px-3'
                        } ${
                          isActive
                            ? 'bg-primary/40 font-semibold text-white before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-primary-fixed-dim'
                            : 'text-on-primary hover:bg-primary/40 hover:text-white'
                        }`
                      }
                    >
                      <span className="relative shrink-0">
                        <Icon name={item.icon} size={20} />
                        {collapsed && item.badge ? (
                          <span
                            className={`absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary ${
                              item.badgeTone === 'danger' ? 'bg-error' : 'bg-secondary-container'
                            }`}
                          />
                        ) : null}
                      </span>
                      {!collapsed ? (
                        <>
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          {item.badge ? (
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold leading-4 ${
                                item.badgeTone === 'danger'
                                  ? 'bg-error text-on-error'
                                  : 'bg-on-primary/15 text-white'
                              }`}
                            >
                              {item.badge}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-on-primary/20">
        <div className={`flex items-center gap-3 p-3 ${collapsed ? 'flex-col' : ''}`}>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-label-lg font-bold text-on-secondary-container ${
              collapsed ? '' : ''
            }`}
          >
            {initials}
          </div>
          {!collapsed ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-md font-semibold text-white">{userName}</p>
                <p className="truncate text-label-md text-primary-fixed-dim">{userRole.replace('_', ' ')}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={onOpenProfile}
                  aria-label={t('nav.myProfile')}
                  title={t('nav.myProfile')}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-primary-fixed-dim transition-colors hover:bg-primary/40 hover:text-white"
                >
                  <Icon name="eye" size={18} />
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label={t('common.logout')}
                  title={t('common.logout')}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-primary-fixed-dim transition-colors hover:bg-error hover:text-on-error"
                >
                  <Icon name="logOut" size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={onOpenProfile}
                aria-label={t('nav.myProfile')}
                title={t('nav.myProfile')}
                className="flex h-9 w-9 items-center justify-center rounded-full text-primary-fixed-dim transition-colors hover:bg-primary/40 hover:text-white"
              >
                <Icon name="eye" size={18} />
              </button>
              <button
                type="button"
                onClick={onLogout}
                aria-label={t('common.logout')}
                title={t('common.logout')}
                className="flex h-9 w-9 items-center justify-center rounded-full text-primary-fixed-dim transition-colors hover:bg-error hover:text-on-error"
              >
                <Icon name="logOut" size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-[300] hidden transition-[width] duration-200 lg:block ${
          collapsed ? 'w-[76px]' : 'w-[264px]'
        }`}
      >
        {content}
      </aside>
      {/* Mobile */}
      {open ? (
        <div className="fixed inset-0 z-[400] lg:hidden">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/40" onClick={onClose} />
          <aside className="relative h-full w-[280px] shadow-modal">{content}</aside>
        </div>
      ) : null}
    </>
  )
}

function TopAppBar({
  title,
  breadcrumbs,
  online,
  onMenuClick,
  onOpenProfile,
  onLogout,
}: {
  title: string
  breadcrumbs: { label: string; to?: string }[] | null
  online: boolean
  onMenuClick: () => void
  onOpenProfile: () => void
  onLogout: () => void
}) {
  const { t, locale, toggleLanguage } = useLocalization()
  const { user } = useAuth()
  const { addToast } = useUIStore()
  const [bellOpen, setBellOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSync = async () => {
    addToast('success', t('nav.syncComplete'))
  }

  return (
    <header className="sticky top-0 z-[200] flex min-h-[64px] items-center gap-3 border-b border-outline-variant bg-surface-container-lowest px-5 py-2 desktop:px-8">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onMenuClick}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-on-surface hover:bg-surface-container lg:hidden"
      >
        <Icon name="menu" size={22} />
      </button>

      <div className="min-w-0 flex-1">
        <h2 className="truncate font-headline-md text-headline-md leading-tight text-on-surface">{title}</h2>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="mt-0.5 hidden min-w-0 items-center gap-1 text-label-md text-on-surface-variant sm:flex" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex min-w-0 items-center gap-1">
                {i > 0 ? <Icon name="chevronRight" size={14} className="shrink-0" /> : null}
                {crumb.to ? (
                  <Link to={crumb.to} className="truncate hover:text-on-surface hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="truncate font-semibold text-on-surface">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 font-label-md text-label-md md:flex ${
            online ? 'bg-secondary-container/60 text-on-secondary-container' : 'bg-error-container text-on-error-container'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${online ? 'bg-secondary' : 'bg-error'}`} />
          {online ? t('nav.online') : t('nav.offline')}
        </span>

        <span className="mx-1 hidden h-6 w-px bg-outline-variant md:block" />

        <button
          type="button"
          onClick={handleSync}
          aria-label={t('nav.syncNow')}
          title={t('nav.syncNow')}
          className="hidden md:flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-on-surface transition-colors hover:bg-surface-container active:scale-[0.97]"
        >
          <Icon name="refresh" size={22} />
        </button>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label={t('nav.search')}
          title={t('nav.search')}
          className={HEADER_ICON_BUTTON}
        >
          <Icon name="search" size={22} />
        </button>
        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

        <button
          type="button"
          onClick={toggleLanguage}
          aria-label={locale === 'hi' ? 'Switch to English' : 'हिंदी पर स्विच करें'}
          className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 font-label-md text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container"
        >
          <Icon name="globe" size={20} />
          <span>{locale === 'hi' ? 'EN' : 'हिं'}</span>
        </button>

        <div ref={bellRef} className="relative">
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => setBellOpen((v) => !v)}
            className={HEADER_ICON_BUTTON}
          >
            <Icon name="bell" size={22} />
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-4 text-on-error ring-2 ring-surface-container-lowest">
              {SAMPLE_NOTIFICATIONS.length}
            </span>
          </button>
          {bellOpen ? (
            <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-lg bg-surface-container-lowest shadow-modal">
              <p className="border-b border-outline-variant px-4 py-3 text-label-lg text-on-surface">{t('nav.alerts')}</p>
              <ul className="max-h-72 divide-y divide-outline-variant overflow-y-auto">
                {SAMPLE_NOTIFICATIONS.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                    <StatusChip
                      status={n.tone === 'danger' ? 'danger' : n.tone === 'warning' ? 'warning' : 'info'}
                      label={n.tone}
                    />
                    <div className="min-w-0">
                      <p className="text-body-md font-semibold text-on-surface">{n.title}</p>
                      <p className="text-body-md text-on-surface-variant">{n.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {user?.role === 'asha' || user?.role === 'patient' ? (
                <Link
                  to={user?.role === 'patient' ? '/patient/notifications' : '/asha/notifications'}
                  onClick={() => setBellOpen(false)}
                  className="flex items-center justify-center gap-1 border-t border-outline-variant px-4 py-3 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container"
                >
                  {t('nav.notifications')}
                  <Icon name="chevronRight" size={16} />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="User menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-11 shrink-0 items-center gap-2 rounded-md px-2 text-on-surface transition-colors hover:bg-surface-container"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-label-lg font-bold text-on-primary">
              {(user?.fullName ?? '?').charAt(0).toUpperCase()}
            </span>
            <span className="hidden max-w-[180px] truncate text-body-md font-medium desktop:inline">{user?.fullName ?? ''}</span>
            <Icon name="chevronDown" size={16} className="hidden shrink-0 text-on-surface-variant sm:inline" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-lg bg-surface-container-lowest shadow-modal">
              <div className="border-b border-outline-variant px-4 py-3">
                <p className="truncate text-body-md font-semibold text-on-surface">{user?.fullName ?? ''}</p>
                <p className="text-label-md text-on-surface-variant">{user?.role.replace('_', ' ')}</p>
              </div>
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenProfile()
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
                >
                  <Icon name="eye" size={18} />
                  {t('nav.myProfile')}
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
                >
                  <Icon name="logOut" size={18} />
                  {t('common.logout')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

function MobileBottomNav({ sections }: { sections: NavSection[] }) {
  const { t } = useLocalization()
  const items = sections.flatMap((s) => s.items).filter((item) => item.bottomNav !== false)

  return (
    <nav className="fixed bottom-0 left-0 z-[500] flex w-full items-center justify-around border-t border-outline-variant/40 bg-surface-container-low px-2 py-2 lg:hidden">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.end}
          className={({ isActive }) =>
            `relative flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all ${
              isActive ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container'
            }`
          }
        >
          <span className="relative">
            <Icon name={item.icon} size={22} />
            {item.badge ? (
              <span
                className={`absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border border-surface-container-low ${
                  item.badgeTone === 'danger' ? 'bg-error' : 'bg-secondary'
                }`}
              />
            ) : null}
          </span>
          <span className="font-caption text-[11px] font-semibold">{t(item.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function ToastContainer() {
  const { toasts } = useUIStore()

  const toneClasses: Record<Toast['tone'], string> = {
    success: 'border-tertiary/40 bg-tertiary',
    error: 'border-error/40 bg-error',
    info: 'border-primary/40 bg-primary',
    warning: 'border-secondary/40 bg-secondary',
  }

  return (
    <div className="fixed bottom-4 right-4 z-[800] flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-2 rounded-lg px-4 py-3 text-body-md text-white shadow-modal ${toneClasses[toast.tone]}`}
          role="status"
        >
          <Icon name={toast.tone === 'error' ? 'alert' : 'checkCircle'} size={18} className="mt-0.5 shrink-0" />
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
