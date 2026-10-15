import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { Icon } from '@/components/common/Icons'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { childService } from '@/services/child.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import type { Immunization } from '@/types'
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

function toDose(imm: Immunization): VaccineDose {
  const status: VaccineDose['status'] =
    imm.status === 'given' ? 'given' : imm.status === 'overdue' ? 'overdue' : 'due'
  const iso = status === 'given' ? imm.administeredDate : imm.dueDate
  let date = '—'
  if (iso) {
    const parsed = new Date(iso)
    date = Number.isNaN(parsed.getTime())
      ? iso
      : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return {
    id: imm.id,
    name: imm.vaccineName || imm.vaccineCode,
    vaccines: `Dose ${imm.doseNumber} · ${imm.vaccineCode}`,
    date,
    status,
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function ImmunizationScheduleAshaSathi() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const [childId, setChildId] = useState('')

  const beneficiaryQuery = useQuery({
    queryKey: ['beneficiary', id],
    queryFn: () => beneficiaryService.getBeneficiary(id ?? ''),
    enabled: Boolean(id),
  })

  const childrenQuery = useQuery({
    queryKey: ['children', 'all'],
    queryFn: () => childService.listChildren({ pageSize: 100 }),
  })
  const beneficiariesQuery = useQuery({
    queryKey: ['beneficiaries', 'all'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })
  const childOptions = childrenQuery.data?.items ?? []
  const benMap = new Map((beneficiariesQuery.data?.items ?? []).map((b) => [b.id, b]))
  // Prefer the child linked to the patient this page was opened for.
  const linkedChild = childOptions.find((c) => c.beneficiary_id === beneficiaryQuery.data?.beneficiary.id)
  const activeChildId = childId || linkedChild?.id || ''

  const immunizationQuery = useQuery({
    queryKey: ['immunizations', activeChildId],
    queryFn: () => childService.listImmunizations(activeChildId),
    enabled: Boolean(activeChildId),
  })

  const doses = (immunizationQuery.data ?? []).map(toDose)

  const patient = beneficiaryQuery.data?.beneficiary
  const patientName = patient?.name ?? '—'
  const patientAbhaId = patient?.abhaId ?? '—'

  const markMutation = useMutation({
    mutationFn: (immunizationId: string) =>
      childService.updateImmunization(immunizationId, { status: 'given', givenDate: todayISO() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['immunizations'] })
      addToast('success', t('asha.doseMarkedToast'))
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const markDone = (doseId: string) => {
    if (markMutation.isPending) return
    markMutation.mutate(doseId)
  }

  const currentDose = doses.find((d) => d.status === 'due')

  const scheduleBody = (() => {
    if (childrenQuery.isLoading || beneficiariesQuery.isLoading) return <LoadingState />
    if (childrenQuery.isError) {
      return <ErrorState message={getErrorMessage(childrenQuery.error)} onRetry={() => childrenQuery.refetch()} />
    }
    if (!activeChildId) {
      return <EmptyState title={t('asha.immunizationEmpty')} description={t('asha.selectChild')} />
    }
    if (immunizationQuery.isLoading) return <LoadingState />
    if (immunizationQuery.isError) {
      return <ErrorState message={getErrorMessage(immunizationQuery.error)} onRetry={() => immunizationQuery.refetch()} />
    }
    if (doses.length === 0) {
      return <EmptyState title={t('asha.immunizationEmpty')} description={t('asha.immunizationEmptyHint')} />
    }
    return (
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
                  disabled={markMutation.isPending}
                  onClick={() => markDone(dose.id)}
                  className="mt-2 flex h-10 w-full items-center justify-center gap-1 rounded-lg bg-primary font-label-md text-label-md font-semibold text-on-primary transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60 md:w-auto md:px-4"
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
    )
  })()

  return (
    <div className="mx-auto max-w-7xl">

      <div className="mb-6 mt-2">
        <h1 className="font-display-lg text-display-lg font-bold text-primary">{t('asha.vaccinationTracking')}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {t('asha.patientLabel', { name: patientName, id: patientAbhaId })}
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

          {childOptions.length > 1 ? (
            <div className="mb-5 flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="immunization_child">
                {t('asha.selectChild')}
              </label>
              <select
                id="immunization_child"
                value={activeChildId}
                onChange={(e) => setChildId(e.target.value)}
                className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {childOptions.map((child) => (
                  <option key={child.id} value={child.id}>
                    {benMap.get(child.beneficiary_id)?.name ?? child.id}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {scheduleBody}
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
            to={`/asha/patients/${patient?.id ?? id ?? ''}`}
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
