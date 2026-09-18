import { NavLink } from 'react-router-dom'
import { LogoutButton } from '@/components/common/LogoutButton'

interface NavItem {
  label: string
  route: string
  icon: string
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', route: '/phc/dashboard', icon: 'dashboard', end: true },
  { label: 'Workers', route: '/phc/ashas', icon: 'groups' },
  { label: 'Households', route: '/phc/households', icon: 'house' },
  { label: 'Beneficiaries', route: '/phc/beneficiaries', icon: 'person_celebrate' },
  { label: 'Maternal Health', route: '/phc/maternal', icon: 'pregnant_woman' },
  { label: 'Child Health', route: '/phc/children', icon: 'child_care' },
  { label: 'Vaccination', route: '/phc/vaccination', icon: 'inventory_2' },
  { label: 'Referrals', route: '/phc/referrals', icon: 'medical_services' },
  { label: 'Follow-ups', route: '/phc/follow-ups', icon: 'assignment' },
  { label: 'Alerts', route: '/phc/alerts', icon: 'notifications_active' },
  { label: 'Reports', route: '/phc/reports', icon: 'description' },
  { label: 'Analytics', route: '/phc/analytics', icon: 'monitoring' },
  { label: 'Audit Logs', route: '/phc/audit-logs', icon: 'history' },
  { label: 'Villages', route: '/phc/villages/new', icon: 'add_location_alt' },
  { label: 'Sanitize', route: '/phc/sanitize', icon: 'cleaning_services' },
]

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'Settings', route: '/phc/settings', icon: 'settings' },
]

const MOBILE_ITEMS: NavItem[] = [
  { label: 'Home', route: '/phc/dashboard', icon: 'home', end: true },
  { label: 'Workers', route: '/phc/ashas', icon: 'groups' },
  { label: 'Patients', route: '/phc/beneficiaries', icon: 'person_celebrate' },
  { label: 'Households', route: '/phc/households', icon: 'house' },
  { label: 'Alerts', route: '/phc/alerts', icon: 'notifications_active' },
]

function SidebarContent() {
  return (
    <>
      <div className="flex items-center gap-3 mb-6 px-1">
        <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-secondary-container">local_hospital</span>
        </div>
        <div>
          <h1 className="text-headline-md font-bold text-white">ASHA Sathi</h1>
          <p className="text-caption text-primary-fixed-dim">PHC Admin Portal</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.route}
            to={item.route}
            end={item.end}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-label-md transition-all duration-150 ${
                isActive
                  ? 'bg-primary/40 text-white font-semibold'
                  : 'text-on-primary hover:bg-primary/40 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary-fixed-dim" />
                )}
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t border-on-primary/20 flex items-center justify-around">
        {BOTTOM_ITEMS.map((item) => (
          <NavLink
            key={item.route}
            to={item.route}
            className={({ isActive }) =>
              `relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150 ${
                isActive
                  ? 'bg-primary/40 text-white'
                  : 'text-on-primary hover:bg-primary/40 hover:text-white'
              }`
            }
            title={item.label}
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
          </NavLink>
        ))}
        <a
          href="#"
          className="flex items-center justify-center w-10 h-10 rounded-lg text-on-primary hover:bg-primary/40 hover:text-white transition-all duration-150"
          title="Support"
        >
          <span className="material-symbols-outlined text-[20px]">help</span>
        </a>
        <LogoutButton className="flex items-center justify-center w-10 h-10 rounded-lg text-on-primary hover:bg-error hover:text-on-error transition-all duration-150">
          <span className="material-symbols-outlined text-[20px]" title="Logout">logout</span>
        </LogoutButton>
      </div>
    </>
  )
}

function MobileNavItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.route}
      end={item.end}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-all duration-200 ${
          isActive
            ? 'text-primary font-semibold'
            : 'text-on-surface-variant'
        }`
      }
    >
      <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
      <span className="text-[10px] leading-tight">{item.label}</span>
    </NavLink>
  )
}

export function PhcSidebar() {
  return (
    <>
      <nav className="hidden md:flex flex-col h-screen fixed left-0 top-0 w-64 bg-primary text-on-primary border-r border-on-primary/20 z-50 p-4 gap-2">
        <SidebarContent />
      </nav>

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-2 bg-surface-container-low border-t border-outline-variant rounded-t-xl shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        {MOBILE_ITEMS.map((item) => (
          <MobileNavItem key={item.route} item={item} />
        ))}
      </nav>
    </>
  )
}
