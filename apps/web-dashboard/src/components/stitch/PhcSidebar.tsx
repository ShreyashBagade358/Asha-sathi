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
    <aside className="hidden md:flex flex-col fixed left-0 top-0 p-md gap-sm bg-primary text-on-primary border-r border-on-primary/20 w-64 h-full z-40">
      <div className="flex flex-col mb-lg">
        <span className="font-headline-md text-headline-md font-black text-white mb-sm">{title}</span>
        {subtitle && <p className="font-caption text-caption text-primary-fixed-dim">{subtitle}</p>}
        {avatarSrc && (
          <div className="flex items-center gap-sm mt-md p-sm bg-primary/40 rounded-lg border border-on-primary/20">
            <img alt={avatarAlt ?? 'User avatar'} className="w-10 h-10 rounded-full object-cover" src={avatarSrc} />
            <div>
              <p className="font-label-md text-label-md text-white">Admin Portal</p>
              <p className="font-caption text-caption text-primary-fixed-dim">District Health Office</p>
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
              `flex items-center gap-md p-sm rounded-lg font-label-md text-label-md transition-all ${isActive ? 'bg-primary/40 text-white font-bold' : 'text-on-primary hover:bg-primary/40 hover:text-white'}`
            }
          >
            <StitchIcon name={item.icon} size={24} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      {bottomItems.length > 0 && (
        <div className="flex flex-col gap-unit mt-auto border-t border-on-primary/20 pt-sm">
          {bottomItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-md p-sm rounded-lg font-label-md text-label-md transition-all ${isActive ? 'bg-primary/40 text-white font-bold' : 'text-on-primary hover:bg-primary/40 hover:text-white'}`
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
