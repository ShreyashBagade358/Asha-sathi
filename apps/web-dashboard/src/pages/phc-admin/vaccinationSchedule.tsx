import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { useQuery } from '@tanstack/react-query'
import { childService } from '@/services/child.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ageInfo(dob: string): { label: string } | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const months = Math.max(0, Math.floor((Date.now() - d.getTime()) / (30.44 * 86400000)))
  return { label: months >= 24 ? `${Math.floor(months / 12)} Years (${months} Months)` : `${months} Weeks` }
}

export default function ChildVaccinationSchedulePhcAdmin() {
  const { id } = useParams<{ id: string }>()

  const { data: child, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['child', id],
    queryFn: () => childService.getChild(id ?? ''),
    enabled: !!id,
  })

  const { data: immunizations, isLoading: immLoading, isError: immError, error: immErrObj, refetch: immRefetch } = useQuery({
    queryKey: ['child-immunizations', id],
    queryFn: () => childService.listImmunizations(id ?? ''),
    enabled: !!id,
  })

  const { data: benData } = useQuery({
    queryKey: ['beneficiaries-map'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })

  const beneficiary = useMemo(() => {
    if (!child) return undefined
    return benData?.items?.find((b) => b.id === child.beneficiaryId)
  }, [benData, child])

  const name = beneficiary?.name ?? child?.name ?? '—'
  const age = child ? ageInfo(child.dob) : null
  const given = (immunizations ?? []).filter((i) => i.status === 'given')
  const due = (immunizations ?? []).filter((i) => i.status === 'due' || i.status === 'overdue')
  const onTrack = (immunizations ?? []).length > 0 && given.length >= (immunizations ?? []).length

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto"><LoadingState label="Loading vaccination record…" /></main>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto"><ErrorState message={getErrorMessage(error)} onRetry={refetch} /></main>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-6 bg-background w-full overflow-y-auto flex flex-col pb-24 md:pb-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-2">
          <div>
            <Link className="flex items-center text-primary text-label-md hover:underline mb-1" to={`/phc/children/${id}`}>
              <span className="material-symbols-outlined text-[16px] mr-1">arrow_back</span>
              Back to Child Profile
            </Link>
            <h1 className="text-2xl font-semibold text-on-surface">Vaccination Record</h1>
          </div>
          <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-3 shadow-sm w-full md:w-auto">
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
              {(name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-label-md text-on-surface">{name}</p>
              <p className="text-caption text-on-surface-variant">{age ? `DOB: ${formatDate(child?.dob ?? '')} (${age.label})` : '—'}</p>
            </div>
            <div className="ml-auto md:ml-3 bg-secondary-container text-on-secondary-container px-2 py-1 rounded-full text-caption flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">check_circle</span> {onTrack ? 'On Track' : 'In Progress'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex justify-between items-center bg-surface-container-lowest border border-outline-variant rounded-t-xl p-4 border-b-0">
              <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">calendar_month</span>
                Immunization Schedule
              </h2>
              <button className="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md flex items-center gap-1 hover:bg-surface-tint transition-colors">
                <span className="material-symbols-outlined text-[18px]">add</span> Record Dose
              </button>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-b-xl rounded-t-none shadow-sm flex flex-col overflow-hidden">
              {immLoading ? (
                <LoadingState label="Loading immunizations…" />
              ) : immError ? (
                <div className="p-4"><ErrorState message={getErrorMessage(immErrObj)} onRetry={immRefetch} /></div>
              ) : (immunizations ?? []).length === 0 ? (
                <div className="p-8 text-center text-body-md text-on-surface-variant">No immunization records available.</div>
              ) : (
                <div className="flex flex-col">
                  <div className="bg-surface-container-low px-4 py-2 border-y border-outline-variant flex items-center">
                    <h3 className="text-label-md text-on-surface-variant uppercase tracking-wider">Recorded Doses</h3>
                  </div>
                  <div className="p-4 flex flex-col gap-2">
                    {(immunizations ?? []).map((imm) => {
                      const isGiven = imm.status === 'given'
                      return (
                        <div key={imm.id} className={`flex flex-col md:flex-row justify-between md:items-center bg-surface border rounded-lg p-3 relative overflow-hidden ${isGiven ? 'border-outline-variant' : 'border-primary border-2'}`}>
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${isGiven ? 'bg-secondary' : 'bg-primary'}`}></div>
                          <div className="pl-2 flex flex-col">
                            <span className="text-label-md text-on-surface">{imm.vaccineName}</span>
                            <span className="text-caption text-on-surface-variant">Dose {imm.doseNumber}</span>
                          </div>
                          <div className="mt-2 md:mt-0 flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                            <div className="flex flex-col text-left md:text-right">
                              <span className={`text-label-md flex items-center gap-1 ${isGiven ? 'text-secondary' : 'text-primary font-bold'}`}>
                                <span className="material-symbols-outlined text-[16px]">{isGiven ? 'done_all' : 'schedule'}</span>
                                {isGiven ? 'Administered' : 'Due'}
                              </span>
                              <span className="text-caption text-on-surface-variant">{isGiven ? formatDate(imm.administeredDate ?? '') : `Due: ${formatDate(imm.dueDate)}`}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
              <div className="bg-tertiary-container p-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-on-tertiary-container">event</span>
                <h3 className="text-label-md text-on-tertiary-container">Immunization Summary</h3>
              </div>
              <div className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-caption text-on-surface-variant">Total doses</span>
                  <span className="text-lg font-semibold text-on-surface">{(immunizations ?? []).length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-caption text-on-surface-variant">Given</span>
                  <span className="text-lg font-semibold text-secondary">{given.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-caption text-on-surface-variant">Due</span>
                  <span className="text-lg font-semibold text-primary">{due.length}</span>
                </div>
              </div>
            </div>

            <div className="relative rounded-xl overflow-hidden shadow-md border border-outline-variant p-4 isolate">
              <div className="absolute inset-0 bg-gradient-to-br from-surface-variant/50 to-surface-bright/80 backdrop-blur-md -z-10"></div>
              <h3 className="text-label-md text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">monitor_weight</span> Vitals Summary
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface-container-lowest/70 p-3 rounded-lg border border-outline-variant/50 text-center">
                  <span className="block text-caption text-on-surface-variant mb-1">Birth Weight</span>
                  <span className="block text-lg font-semibold text-on-surface">{child?.birthWeightKg != null ? `${child.birthWeightKg} kg` : '—'}</span>
                </div>
                <div className="bg-surface-container-lowest/70 p-3 rounded-lg border border-outline-variant/50 text-center">
                  <span className="block text-caption text-on-surface-variant mb-1">Gestation</span>
                  <span className="block text-lg font-semibold text-on-surface">{child?.gestationalAgeWeeks != null ? `${child.gestationalAgeWeeks} wks` : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
