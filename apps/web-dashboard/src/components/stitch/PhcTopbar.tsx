import { useState } from 'react'
import { StitchIcon } from './StitchIcon'

interface PhcTopbarProps {
  title: string
  subtitle?: string
  syncLabel?: string
  syncStatus?: 'online' | 'offline'
  unreadBadge?: boolean
  avatarSrc?: string
  avatarAlt?: string
  onMenuClick?: () => void
}

export function PhcTopbar({
  title,
  subtitle,
  syncLabel,
  syncStatus = 'online',
  unreadBadge,
  avatarSrc,
  avatarAlt,
  onMenuClick,
}: PhcTopbarProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  return (
    <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 z-10 shrink-0">
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2 text-on-surface-variant" onClick={onMenuClick} aria-label="Open menu">
          <StitchIcon name="menu" />
        </button>
        <div>
          <h2 className="text-headline-md text-on-surface">{title}</h2>
          {subtitle && (
            <p className={`text-caption flex items-center gap-1 ${syncStatus === 'online' ? 'text-secondary' : 'text-error'}`}>
              <StitchIcon name="fiber_manual_record" filled size={12} />
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-6">
        {syncLabel && (
          <div className="hidden md:flex items-center bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant">
            <StitchIcon name="sync" filled className="text-secondary mr-2" size={16} />
            <span className="text-label-md text-on-surface">
              {syncLabel}: <span className={`font-bold ${syncStatus === 'online' ? 'text-secondary' : 'text-error'}`}>{syncStatus === 'online' ? 'Online' : 'Offline'}</span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 relative">
          <button
            className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full relative"
            onClick={() => setNotificationsOpen((o) => !o)}
            aria-label="Notifications"
          >
            <StitchIcon name="notifications" filled />
            {unreadBadge && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 top-12 w-72 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-modal p-4 z-50">
              <p className="font-label-md text-label-md text-on-surface mb-2">Notifications</p>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low">
                <StitchIcon name="warning" filled className="text-error mt-0.5" />
                <div>
                  <p className="font-body-md text-body-md text-on-surface">High-risk pregnancy follow-up missed</p>
                  <p className="font-caption text-caption text-on-surface-variant">2h ago</p>
                </div>
              </div>
            </div>
          )}
          {avatarSrc && (
            <img alt={avatarAlt ?? 'User avatar'} className="w-8 h-8 rounded-full object-cover border border-outline-variant" src={avatarSrc} />
          )}
        </div>
      </div>
    </header>
  )
}
