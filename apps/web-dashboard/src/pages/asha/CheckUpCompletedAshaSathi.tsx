import { Link } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon } from '@/components/common/Icons'

export default function CheckUpCompletedAshaSathi() {
  const { t } = useLocalization()

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-between gap-6 py-4">
      <div className="flex flex-col items-center pb-6 pt-10 animate-pop-in">
        <div className="relative mb-4 flex h-32 w-32 items-center justify-center rounded-full bg-secondary-container shadow-lg shadow-secondary-container/20">
          <div className="absolute inset-0 scale-125 rounded-full border-4 border-secondary-container opacity-30" />
          <div className="absolute inset-0 scale-150 rounded-full border-2 border-secondary-container opacity-10" />
          <Icon name="checkCircle" size={72} className="text-on-secondary-container" />
        </div>
        <h1 className="mb-1 text-center font-headline-lg text-headline-lg text-on-surface">{t('asha.registrationComplete')}</h1>
        <p className="max-w-[280px] text-center font-body-lg text-body-lg text-on-surface-variant">
          {t('asha.checkupRecorded')}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <div className="flex animate-slide-up items-start gap-4 rounded-3xl border-l-4 border-error bg-error-container p-4 shadow-sm delay-100">
          <div className="flex shrink-0 items-center justify-center rounded-full bg-error/10 p-2">
            <Icon name="alert" size={28} className="text-error" />
          </div>
          <div className="flex-1 pt-1">
            <h2 className="mb-1 font-label-md text-label-md uppercase tracking-widest text-on-error-container/80">
              {t('asha.riskIndicator')}
            </h2>
            <p className="font-headline-md text-headline-md leading-tight text-on-error-container">{t('asha.highRiskPregnancy')}</p>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-error/20 px-3 py-1">
              <Icon name="activity" size={16} className="text-on-error-container" />
              <span className="font-caption text-caption font-semibold text-on-error-container">
                {t('asha.elevatedBp')}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex animate-slide-up flex-col items-center justify-center rounded-3xl bg-surface-container-high p-5 text-center shadow-sm delay-200">
            <div className="mb-2 rounded-full bg-primary-container/20 p-2">
              <Icon name="calendar" size={28} className="text-primary" />
            </div>
            <h3 className="mb-1 font-label-md text-label-md text-on-surface-variant">{t('asha.nextVisitLabel')}</h3>
            <p className="font-headline-md text-headline-md text-[22px] text-on-surface">Oct 24</p>
          </div>
          <div className="relative flex animate-slide-up flex-col items-center justify-center rounded-3xl border border-outline-variant/30 bg-surface-container p-5 text-center shadow-sm delay-300">
            <div className="absolute right-4 top-4 h-3 w-3 rounded-full bg-outline shadow-sm" />
            <div className="mb-2 rounded-full bg-surface-variant/50 p-2">
              <Icon name="box" size={28} className="text-on-surface-variant" />
            </div>
            <h3 className="mb-1 font-label-md text-label-md text-on-surface-variant">{t('asha.dataStatus')}</h3>
            <p className="font-label-md text-label-md text-on-surface">{t('asha.storedLocally')}</p>
            <p className="mt-1 font-caption text-caption text-on-surface-variant">{t('asha.pendingSync')}</p>
          </div>
        </div>
      </div>

      <div className="flex animate-slide-up flex-col gap-2 pb-4 delay-300 sm:flex-row sm:justify-center">
        <Link
          to="/asha/home"
          className="flex h-touch-target items-center justify-center gap-2 rounded-full bg-primary font-label-md text-label-md font-semibold text-on-primary shadow-md transition-transform duration-200 active:scale-95 sm:min-w-56"
        >
          <Icon name="dashboard" size={18} />
          {t('asha.goToDashboard')}
        </Link>
        <Link
          to="/asha/patients/1"
          className="flex h-touch-target items-center justify-center gap-2 rounded-full border border-outline font-label-md text-label-md font-semibold text-primary transition-colors duration-200 active:bg-surface-variant sm:min-w-56"
        >
          <Icon name="users" size={18} />
          {t('asha.viewPatientProfile')}
        </Link>
      </div>
    </div>
  )
}
