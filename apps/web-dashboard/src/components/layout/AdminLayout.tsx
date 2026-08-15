import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ASHAButton, StatusChip } from 'asha-design-system'
import { useAuth } from '@/hooks/useAuth'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore, type Toast } from '@/stores/ui.store'
import { Icon, type IconName } from '@/components/common/Icons'
import type { Role } from '@/types'

interface NavItem {
  labelKey: string
  path: string
  icon: IconName
  end?: boolean
}

interface NavSection {
  titleKey?: string
  items: NavItem[]
}

const NAV_SECTIONS: Record<string, NavSection[]> = {
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
}

const ROLE_SECTIONS: Record<Role, string[]> = {
  asha: ['phc'],
  anm: ['phc'],
  moic: ['phc'],
  bpm: ['phc'],
  dpm: ['district'],
  state_admin: ['state'],
  super_admin: ['super', 'state', 'district', 'phc'],
}

const SAMPLE_NOTIFICATIONS = [
  { id: 'n1', tone: 'danger' as const, title: 'HRP escalation', message: 'Sunita Devi (Rampur) BP 160/100' },
  { id: 'n2', tone: 'warning' as const, title: 'Stockout alert', message: 'Inj. Oxytocin below threshold at PHC' },
  { id: 'n3', tone: 'info' as const, title: 'Sync failure', message: 'ASHA Saroj Yadav failed to sync' },
]

export function AdminLayout() {
  const { t } = useLocalization()
  const { user, logout } = useAuth()
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const navigate = useNavigate()
  const location = useLocation()

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

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sections={sections}
        userName={user?.fullName ?? ''}
        userRole={user?.role ?? 'asha'}
        onLogout={handleLogout}
      />
      <div className="flex min-h-screen flex-col lg:pl-[264px]">
        <TopAppBar title={t(currentTitleKey)} onMenuClick={() => setSidebarOpen(true)} onLogout={handleLogout} />
        <main className="flex-1 px-5 py-6 desktop:px-8">
          <Outlet />
        </main>
        <footer className="border-t border-outline-variant px-5 py-4 text-label-md text-on-surface-variant">
          {t('common.appName')} · {t('common.welcome')}, {user?.fullName ?? ''}
        </footer>
      </div>
      <ToastContainer />
    </div>
  )
}

function Sidebar({
  open,
  onClose,
  sections,
  userName,
  userRole,
  onLogout,
}: {
  open: boolean
  onClose: () => void
  sections: NavSection[]
  userName: string
  userRole: Role
  onLogout: () => void
}) {
  const { t } = useLocalization()

  const content = (
    <div className="flex h-full flex-col bg-primary text-on-primary">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-white">
          <Icon name="heart" size={22} />
        </div>
        <div>
          <p className="text-body-md font-bold leading-tight">{t('common.appName')}</p>
          <p className="text-label-md text-primary-fixed-dim">Admin Console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
        {sections.map((section, idx) => (
          <div key={idx}>
            {section.titleKey ? (
              <p className="px-3 pb-1 pt-2 text-label-md uppercase tracking-wide text-primary-fixed-dim">
                {t(section.titleKey)}
              </p>
            ) : null}
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-2.5 text-body-md font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-container text-on-primary-container'
                          : 'text-on-primary hover:bg-primary/40 hover:text-white'
                      }`
                    }
                  >
                    <Icon name={item.icon} size={20} />
                    {t(item.labelKey)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-on-primary/20 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-label-lg font-bold text-on-primary-container">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-md font-semibold text-white">{userName}</p>
            <p className="text-label-md text-primary-fixed-dim">{userRole.replace('_', ' ')}</p>
          </div>
        </div>
        <ASHAButton variant="outline" fullWidth onClick={onLogout} icon={<Icon name="logOut" size={16} />} label={t('common.logout')} />
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-[300] hidden w-[264px] lg:block">{content}</aside>
      {/* Mobile */}
      {open ? (
        <div className="fixed inset-0 z-[400] lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <aside className="relative h-full w-[280px] shadow-modal">{content}</aside>
        </div>
      ) : null}
    </>
  )
}

function TopAppBar({
  title,
  onMenuClick,
  onLogout,
}: {
  title: string
  onMenuClick: () => void
  onLogout: () => void
}) {
  const { t, locale, toggleLanguage } = useLocalization()
  const { user } = useAuth()
  const [bellOpen, setBellOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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

  return (
    <header className="sticky top-0 z-[200] flex h-[64px] items-center gap-3 border-b border-outline-variant bg-surface-container-lowest px-5 desktop:px-8">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onMenuClick}
        className="flex h-11 w-11 items-center justify-center rounded-md text-on-surface hover:bg-surface-container lg:hidden"
      >
        <Icon name="menu" size={22} />
      </button>
      <h2 className="min-w-0 flex-1 truncate text-headline-md text-on-surface">{title}</h2>

      <div className="flex items-center gap-2">
        <ASHAButton variant="outline" fullWidth={false} onClick={toggleLanguage} icon={<Icon name="globe" size={16} />} label={locale === 'hi' ? 'EN' : 'हिं'} />

        <div ref={bellRef} className="relative">
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => setBellOpen((v) => !v)}
            className="relative flex h-11 w-11 items-center justify-center rounded-md text-on-surface hover:bg-surface-container"
          >
            <Icon name="bell" size={22} />
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-on-error">
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
            </div>
          ) : null}
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="User menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-11 items-center gap-2 rounded-md px-2 text-on-surface hover:bg-surface-container"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-label-lg font-bold text-on-primary">
              {(user?.fullName ?? '?').charAt(0).toUpperCase()}
            </span>
            <span className="hidden text-body-md font-medium desktop:inline">{user?.fullName ?? ''}</span>
            <Icon name="chevronDown" size={16} className="text-on-surface-variant" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-lg bg-surface-container-lowest shadow-modal">
              <div className="border-b border-outline-variant px-4 py-3">
                <p className="truncate text-body-md font-semibold text-on-surface">{user?.fullName ?? ''}</p>
                <p className="text-label-md text-on-surface-variant">{user?.role.replace('_', ' ')}</p>
              </div>
              <div className="p-2">
                <ASHAButton variant="outline" fullWidth onClick={onLogout} icon={<Icon name="logOut" size={16} />} label={t('common.logout')} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
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
