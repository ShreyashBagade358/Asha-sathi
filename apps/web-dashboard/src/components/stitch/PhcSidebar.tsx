import { NavLink } from 'react-router-dom'
import { StitchIcon } from './StitchIcon'

export interface SidebarItem {
  icon: string
  label: string
  to: string
  end?: boolean
}

interface PhcSidebarProps {
  title: string
  subtitle?: string
  items: SidebarItem[]
  bottomItems?: SidebarItem[]
  avatarAlt?: string
  avatarSrc?: string
}

export function PhcSidebar({ title, subtitle, items, bottomItems = [], avatarAlt, avatarSrc }: PhcSidebarProps) {
  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 p-md gap-sm bg-surface-container-low border-r border-outline-variant w-64 h-full z-40">
      <div className="flex flex-col mb-lg">
        <span className="font-headline-md text-headline-md font-black text-primary mb-sm">{title}</span>
        {subtitle && <p className="font-caption text-caption text-on-surface-variant">{subtitle}</p>}
        {avatarSrc && (
          <div className="flex items-center gap-sm mt-md p-sm bg-surface rounded-lg border border-outline-variant">
            <img alt={avatarAlt ?? 'User avatar'} className="w-10 h-10 rounded-full object-cover" src={avatarSrc} />
            <div>
              <p className="font-label-md text-label-md text-on-surface">Admin Portal</p>
              <p className="font-caption text-caption text-on-surface-variant">District Health Office</p>
            </div>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto flex flex-col gap-unit">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-md p-sm rounded-lg font-label-md text-label-md transition-all ${isActive ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-high'}`
            }
          >
            <StitchIcon name={item.icon} size={24} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      {bottomItems.length > 0 && (
        <div className="flex flex-col gap-unit mt-auto border-t border-outline-variant pt-sm">
          {bottomItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-md p-sm rounded-lg font-label-md text-label-md transition-all ${isActive ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-high'}`
              }
            >
              <StitchIcon name={item.icon} size={24} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </aside>
  )
}
