import { NavLink } from 'react-router-dom'
import { StitchIcon } from './StitchIcon'

export interface MobileNavItem {
  icon: string
  label: string
  to: string
  end?: boolean
}

interface AshaMobileNavProps {
  items: MobileNavItem[]
}

export function AshaMobileNav({ items }: AshaMobileNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-sm py-xs bg-surface border-t border-outline-variant rounded-t-full shadow-[0px_-4px_6px_rgba(0,0,0,0.05)] h-touch-target pb-safe">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center px-2 py-1 rounded-lg transition-colors ${isActive ? 'bg-primary-container text-on-primary-container rounded-full px-4 py-1 scale-90' : 'text-on-surface-variant hover:bg-surface-container-highest'}`
          }
        >
          <StitchIcon name={item.icon} size={24} filled={false} />
          <span className="font-caption text-caption text-[10px]">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
