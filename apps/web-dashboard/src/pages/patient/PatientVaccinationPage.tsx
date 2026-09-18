import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { useAppStore, patientPortalProfile } from '@/stores/app.store'
import { Icon, type IconName } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import type { DoseStatus } from '@/pages/patient/mockData'

const DOSE_META: Record<DoseStatus, { label: string; className: string; icon: IconName }> = {
  given: { label: 'patient.doseGiven', className: 'bg-secondary-container text-on-secondary-container', icon: 'checkCircle' },
  due: { label: 'patient.doseDue', className: 'bg-tertiary-container text-on-tertiary-container', icon: 'calendar' },
  overdue: { label: 'patient.doseOverdue', className: 'bg-error-container text-on-error-container', icon: 'alert' },
  upcoming: { label: 'patient.doseUpcoming', className: 'bg-surface-variant text-on-surface-variant', icon: 'calendar' },
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = Math.round((done / total) * 100)
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-caption text-caption text-on-surface-variant">
          {done}/{total} · {pct}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className="h-full rounded-full bg-secondary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function PatientVaccinationPage() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const childVaccines = useAppStore((s) => s.childVaccines)
  const motherVaccines = useAppStore((s) => s.motherVaccines)
  const children = useAppStore((s) => s.children)
  const patients = useAppStore((s) => s.patients)

  const profile = patientPortalProfile(patients)
  const child = children.find((c) => c.village === profile.village)

  const childDone = childVaccines.filter((d) => d.status === 'given').length
  const motherDone = motherVaccines.filter((d) => d.status === 'given').length

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('patient.vaccinationTitle')}
        subtitle={t('patient.vaccinationSubtitle')}
        breadcrumbs={[{ label: t('patient.vaccinationTitle') }]}
        actions={
          <button
            type="button"
            onClick={() => addToast('success', t('patient.certificateToast'))}
            className="flex items-center gap-2 rounded-full border border-outline px-5 py-2.5 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container"
          >
            <Icon name="download" size={18} />
            {t('patient.vaccineCertificate')}
          </button>
        }
      />

      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-card">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <Icon name="heart" size={22} />
          </span>
          <div>
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('patient.childImmunization')}</h2>
            <p className="font-caption text-caption text-on-surface-variant">
              {child ? `${child.name} · ${child.ageMonths} ${t('patient.months')}` : t('patient.childImmunization')}
            </p>
          </div>
        </div>
        <ProgressBar done={childDone} total={childVaccines.length} />
      </section>

      <section className="flex flex-col gap-3">
        {childVaccines.map((dose) => {
          const meta = DOSE_META[dose.status]
          return (
            <div
              key={dose.id}
              className={`flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card ${
                dose.status === 'due' ? 'ring-1 ring-tertiary' : ''
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
                  <Icon name={meta.icon} size={20} />
                </span>
                <div className="min-w-0">
                  <p className="font-label-md text-label-md font-semibold text-on-surface">{dose.name}</p>
                  <p className="truncate font-caption text-caption text-on-surface-variant">{dose.vaccines}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-[11px] font-bold leading-4 ${dose.status === 'due' ? 'text-tertiary' : dose.status === 'overdue' ? 'text-error' : 'text-on-surface-variant'}`}>
                  {t(meta.label)}
                </p>
                <p className="mt-0.5 font-caption text-caption text-on-surface-variant">{dose.date}</p>
              </div>
            </div>
          )
        })}
      </section>

      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-card">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <Icon name="shield" size={22} />
          </span>
          <div>
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('patient.yourImmunization')}</h2>
            <p className="font-caption text-caption text-on-surface-variant">{t('patient.dosesCompleted', { done: motherDone, total: motherVaccines.length })}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {motherVaccines.map((dose) => {
            const meta = DOSE_META[dose.status]
            return (
              <div key={dose.id} className="flex items-center justify-between gap-3 border-b border-outline-variant/40 py-3 last:border-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
                    <Icon name={meta.icon} size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-label-md text-label-md font-semibold text-on-surface">{dose.name}</p>
                    <p className="truncate font-caption text-caption text-on-surface-variant">{dose.vaccines}</p>
                  </div>
                </div>
                <p className="shrink-0 font-caption text-caption text-on-surface-variant">{dose.date}</p>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
