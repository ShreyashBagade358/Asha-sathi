import { useLocalization } from '@/hooks/useLocalization'
import { useAuth } from '@/hooks/useAuth'
import { Icon } from '@/components/common/Icons'

export function ProfilePanel({
  open,
  onClose,
  onLogout,
}: {
  open: boolean
  onClose: () => void
  onLogout: () => void
}) {
  const { t } = useLocalization()
  const { user } = useAuth()

  if (!open) return null

  const fullName = user?.fullName ?? ''
  const role = user?.role.replace('_', ' ') ?? ''

  const rows = [
    { label: 'Phone', value: user?.phone ?? '—' },
    { label: 'State', value: user?.stateName ?? user?.stateId ?? '—' },
    { label: 'District', value: user?.districtName ?? user?.districtId ?? '—' },
    { label: 'Block', value: user?.blockName ?? user?.blockId ?? '—' },
    { label: 'PHC', value: user?.phcName ?? user?.phcId ?? '—' },
    {
      label: t('nav.villages'),
      value: user?.villages?.length ? user.villages.join(', ') : '—',
    },
  ]

  return (
    <div className="fixed inset-0 z-[600]">
      <button type="button" aria-label="Close profile" className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-surface-container-lowest shadow-modal animate-slide-in-right">
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
          <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('nav.myProfile')}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 border-b border-outline-variant px-5 py-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-headline-md font-bold text-on-primary">
            {(fullName.charAt(0) || '?').toUpperCase()}
          </div>
          <div className="text-center">
            <p className="font-headline-md text-headline-md font-semibold text-on-surface">{fullName || '—'}</p>
            <p className="font-body-md text-body-md capitalize text-on-surface-variant">{role}</p>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div>
            <p className="mb-2 font-label-md text-label-md uppercase tracking-wide text-on-surface-variant">
              {t('nav.accountInfo')}
            </p>
            <div className="overflow-hidden rounded-lg border border-outline-variant">
              {rows.map((row, i) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between gap-4 px-4 py-3 ${
                    i < rows.length - 1 ? 'border-b border-outline-variant' : ''
                  }`}
                >
                  <span className="font-caption text-caption text-on-surface-variant">{row.label}</span>
                  <span className="truncate text-right font-body-md text-body-md font-medium text-on-surface">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-outline-variant p-5">
          <button
            type="button"
            onClick={onLogout}
            className="flex h-touch-target w-full items-center justify-center gap-2 rounded-full border border-outline font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-variant"
          >
            <Icon name="logOut" size={18} />
            {t('common.logout')}
          </button>
        </div>
      </aside>
    </div>
  )
}
