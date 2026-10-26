import { useQuery } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon, type IconName } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { patientService, type MyChild } from '@/services/patient.service'
import { childService } from '@/services/child.service'
import type { Immunization } from '@/types'

const STATUS_META: Record<string, { label: string; className: string; icon: IconName }> = {
  given: { label: 'patient.doseGiven', className: 'bg-secondary-container text-on-secondary-container', icon: 'checkCircle' },
  due: { label: 'patient.doseDue', className: 'bg-tertiary-container text-on-tertiary-container', icon: 'calendar' },
  overdue: { label: 'patient.doseOverdue', className: 'bg-error-container text-on-error-container', icon: 'alert' },
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
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

function ChildImmunizationCard({ child, immunizations }: { child: MyChild; immunizations: Immunization[] }) {
  const { t } = useLocalization()
  const done = immunizations.filter((d) => d.status === 'given').length
  const label = child.mother_name || child.father_name || child.id.replace(/-/g, '').slice(0, 8).toUpperCase()

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-card">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
          <Icon name="heart" size={22} />
        </span>
        <div>
          <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('patient.childImmunization')}</h2>
          <p className="font-caption text-caption text-on-surface-variant">{label}</p>
        </div>
      </div>
      <ProgressBar done={done} total={immunizations.length} />
    </section>
  )
}

export default function PatientVaccinationPage() {
  const { t } = useLocalization()

  // Scoped server-side by parentage: only the children this patient bore or
  // fathered. An empty list means no child UI is rendered at all.
  const childrenQuery = useQuery({
    queryKey: ['patient-my-children'],
    queryFn: () => patientService.getMyChildren(),
  })

  const children = childrenQuery.data ?? []
  const firstChild = children[0]

  const immunizationsQuery = useQuery({
    queryKey: ['patient-immunizations', firstChild?.id],
    queryFn: () => childService.listImmunizations(firstChild!.id),
    enabled: Boolean(firstChild?.id),
  })

  const immunizations: Immunization[] = immunizationsQuery.data ?? []

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('patient.vaccinationTitle')}
        subtitle={children.length > 0 ? t('patient.vaccinationSubtitle') : undefined}
      />

      {childrenQuery.isLoading ? (
        <LoadingState label="Loading immunisations…" />
      ) : children.length === 0 ? (
        <EmptyState
          title="No children registered"
          description="Immunisation records appear once a child is registered for this profile by your ASHA worker."
        />
      ) : (
        <>
          <ChildImmunizationCard child={firstChild} immunizations={immunizations} />

          {immunizationsQuery.isLoading ? (
            <LoadingState label="Loading doses…" />
          ) : immunizations.length === 0 ? (
            <EmptyState title="No immunisations yet" description="Vaccination doses will appear here once scheduled." />
          ) : (
            <section className="flex flex-col gap-3">
              {immunizations.map((dose) => {
                const meta = STATUS_META[dose.status] ?? STATUS_META.due
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
                        <p className="font-label-md text-label-md font-semibold text-on-surface">{dose.vaccineName}</p>
                        <p className="truncate font-caption text-caption text-on-surface-variant">
                          Dose {dose.doseNumber} · {dose.vaccineCode}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-label-sm font-bold leading-4 ${dose.status === 'due' ? 'text-tertiary' : dose.status === 'overdue' ? 'text-error' : 'text-on-surface-variant'}`}>
                        {t(meta.label)}
                      </p>
                      <p className="mt-0.5 font-caption text-caption text-on-surface-variant">
                        {dose.administeredDate || dose.dueDate || '—'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </section>
          )}
        </>
      )}
    </div>
  )
}
