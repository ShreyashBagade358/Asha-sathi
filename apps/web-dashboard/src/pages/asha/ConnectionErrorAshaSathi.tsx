import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { Icon } from '@/components/common/Icons'

export default function ConnectionErrorAshaSathi() {
  const { t } = useLocalization()
  const navigate = useNavigate()
  const { addToast } = useUIStore()
  const [checking, setChecking] = useState(false)

  const retry = () => {
    setChecking(true)
    setTimeout(() => {
      setChecking(false)
      addToast('success', t('asha.connectionRestored'))
      navigate('/asha/home')
    }, 1200)
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface px-4 py-12">
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center justify-center pt-8 text-center">
        <div className="relative mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-error-container text-on-error-container shadow-sm">
          <Icon name="box" size={64} />
          <div className="absolute inset-0 animate-ping rounded-full border-4 border-error-container opacity-75" />
        </div>
        <h1 className="mb-2 font-headline-lg text-headline-lg text-on-surface">{t('asha.connectionError')}</h1>
        <p className="mb-8 px-4 font-body-lg text-body-lg text-on-surface-variant">{t('asha.connectionHint')}</p>
        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={retry}
            disabled={checking}
            className="flex h-touch-target w-full items-center justify-center gap-2 rounded-full bg-primary font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors duration-200 hover:bg-on-primary-fixed-variant active:scale-95 disabled:opacity-60"
          >
            <Icon name={checking ? 'refresh' : 'refresh'} size={20} className={checking ? 'animate-spin' : ''} />
            {checking ? t('asha.checking') : t('asha.retryConnection')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/asha/sync')}
            className="flex h-touch-target w-full items-center justify-center gap-2 rounded-full border-2 border-outline-variant font-label-md text-label-md font-semibold text-primary transition-colors duration-200 hover:bg-surface-variant active:scale-95"
          >
            <Icon name="refresh" size={20} />
            {t('asha.openSyncCenter')}
          </button>
        </div>
        <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-high px-4 py-1">
          <div className="h-2 w-2 rounded-full bg-outline" />
          <span className="font-caption text-caption text-on-surface-variant">{t('asha.currentlyOffline')}</span>
        </div>
      </main>
    </div>
  )
}
