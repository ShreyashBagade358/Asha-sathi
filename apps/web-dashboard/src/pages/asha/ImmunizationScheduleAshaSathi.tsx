import { Link, useParams } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { useAppStore } from '@/stores/app.store'
import { Icon } from '@/components/common/Icons'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import type { VaccineDose } from '@/pages/patient/mockData'

const nodeStyles: Record<VaccineDose['status'], string> = {
  given: 'bg-secondary text-on-secondary',
  due: 'bg-primary text-on-primary animate-pulse',
  upcoming: 'bg-outline text-on-primary',
  overdue: 'bg-error text-on-error',
}

const cardStyles: Record<VaccineDose['status'], string> = {
  given: 'border-outline-variant bg-surface',
  due: 'border-primary-fixed-dim bg-primary-fixed',
  upcoming: 'border-outline-variant bg-surface',
  overdue: 'border-error bg-error-container',
}

export default function ImmunizationScheduleAshaSathi() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const patients = useAppStore((s) => s.patients)
  const doses = useAppStore((s) => s.childVaccines)
  const markDoseGiven = useAppStore((s) => s.markDoseGiven)
  const { id } = useParams<{ id: string }>()

  const patient = patients.find((p) => p.id === id) ?? patients[3]

  const markDone = (doseId: string) => {
    markDoseGiven('child', doseId)
    addToast('success', t('asha.doseMarkedToast'))
  }

  const currentDose = doses.find((d) => d.status === 'due')

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumbs
        items={[{ label: t('nav.ashaPatients'), to: '/asha/patients' }, { label: t('nav.immunization') }]}
      />

      <div className="mb-6 mt-2">
        <h1 className="font-display-lg text-display-lg font-bold text-primary">{t('asha.vaccinationTracking')}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {t('asha.patientLabel', { name: patient.name, id: patient.abhaId })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card md:col-span-8 md:p-6">
          <h2 className="mb-5 flex items-center justify-between gap-2 border-b border-outline-variant pb-2 font-headline-md text-headline-md font-semibold text-on-surface">
            {t('asha.immunizationSchedule')}
            <span className="rounded-full bg-secondary-container px-3 py-1 font-label-md text-label-md text-on-secondary-container">
              {t('asha.onTrack')}
            </span>
          </h2>

          <div className="relative space-y-6 border-l-2 border-outline-variant pl-6 md:pl-8">
            {doses.map((dose) => (
              <div key={dose.id} className="relative">
                <span
                  className={`absolute -left-[35px] top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border-4 border-surface-container-lowest md:-left-[43px] ${nodeStyles[dose.status]}`}
                >
                  <Icon name={dose.status === 'given' ? 'check' : dose.status === 'overdue' ? 'alert' : 'calendar'} size={18} />
                </span>
                <div className={`rounded-lg border p-4 ${cardStyles[dose.status]}`}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-label-md text-label-md text-on-surface">{dose.name}</h3>
                      <p className="mt-1 font-caption text-caption text-on-surface-variant">{dose.vaccines}</p>
                    </div>
                    {dose.status === 'given' ? (
                      <span className="font-caption text-caption text-outline">{dose.date}</span>
                    ) : dose.status === 'due' ? (
                      <span className="font-caption text-caption font-bold text-primary">{t('asha.dueLabel', { date: dose.date })}</span>
                    ) : dose.status === 'overdue' ? (
                      <span className="font-caption text-caption font-bold text-error">{t('asha.overdue')}</span>
                    ) : (
                      <span className="font-caption text-caption text-outline">{dose.date}</span>
                    )}
                  </div>
                  {dose.status === 'given' ? (
                    <div className="flex items-center gap-1 font-label-md text-label-md text-secondary">
                      <Icon name="checkCircle" size={16} />
                      {t('asha.administered')}
                    </div>
                  ) : null}
                  {dose.status === 'due' ? (
                    <button
                      type="button"
                      onClick={() => markDone(dose.id)}
                      className="mt-2 flex h-10 w-full items-center justify-center gap-1 rounded-lg bg-primary font-label-md text-label-md font-semibold text-on-primary transition-colors hover:bg-on-primary-fixed-variant md:w-auto md:px-4"
                    >
                      <Icon name="edit" size={18} />
                      {t('asha.markCompleted')}
                    </button>
                  ) : null}
                  {dose.status === 'upcoming' ? (
                    <div className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant">
                      <Icon name="calendar" size={16} />
                      {t('asha.upcoming')}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6 md:col-span-4">
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 text-center shadow-card">
            <Icon name="checkCircle" size={48} className="text-tertiary" />
            <div>
              <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.officialRecords')}</h3>
              <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{t('asha.certificateHint')}</p>
            </div>
            <button
              type="button"
              onClick={() => addToast('success', t('asha.certificateToast'))}
              className="mt-1 flex h-touch-target w-full items-center justify-center gap-1 rounded-full bg-outline-variant font-label-md text-label-md font-semibold text-on-surface transition-colors hover:bg-outline"
            >
              <Icon name="download" size={18} />
              {t('asha.viewCertificate')}
            </button>
          </div>

          <div className="rounded-r-xl border-l-4 border-primary-container bg-surface-container p-4">
            <div className="mb-1 flex items-start gap-2 text-on-surface">
              <Icon name="alert" size={18} className="mt-0.5 text-primary" />
              <h4 className="font-label-md text-label-md font-semibold">{t('asha.nextDoseInfo')}</h4>
            </div>
            <p className="pl-7 font-body-md text-body-md text-on-surface-variant">
              {t('asha.nextDoseHint')}
            </p>
          </div>

          {currentDose ? (
            <button
              type="button"
              onClick={() => markDone(currentDose.id)}
              className="flex h-touch-target w-full items-center justify-center gap-2 rounded-full bg-primary-container font-label-md text-label-md font-semibold text-on-primary-container shadow-sm transition-colors hover:bg-primary hover:text-on-primary md:hidden"
            >
              <Icon name="checkCircle" size={18} />
              {t('asha.markCompleted')}
            </button>
          ) : null}

          <Link
            to={`/asha/patients/${patient.id}`}
            className="flex h-touch-target w-full items-center justify-center gap-2 rounded-full border border-outline font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-variant"
          >
            <Icon name="chevronLeft" size={18} />
            {t('asha.backToPatient')}
          </Link>
        </div>
      </div>
    </div>
  )
}
