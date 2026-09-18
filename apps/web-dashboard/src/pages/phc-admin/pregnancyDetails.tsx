import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pregnancyService } from '@/services/pregnancy.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { useUIStore } from '@/stores/ui.store'

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ageFromDob(iso: string): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000)))
}

function weekFromLmp(lmp: string): number {
  if (!lmp) return 0
  const start = new Date(lmp).getTime()
  if (Number.isNaN(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / (7 * 86400000)))
}

export default function PregnancyDetailsPhcAdmin() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { addToast } = useUIStore()

  const { data: pregnancy, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pregnancy', id],
    queryFn: () => pregnancyService.getPregnancy(id ?? ''),
    enabled: !!id,
  })

  const { data: visits, isLoading: visitsLoading, isError: visitsError, error: visitsErrorObj, refetch: visitsRefetch } = useQuery({
    queryKey: ['pregnancy-anc', id],
    queryFn: () => pregnancyService.listANCVisits(id ?? ''),
    enabled: !!id,
  })

  const { data: benData } = useQuery({
    queryKey: ['beneficiaries-map'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })

  const beneficiary = useMemo(() => {
    if (!pregnancy) return undefined
    return benData?.items?.find((b) => b.id === pregnancy.beneficiaryId)
  }, [benData, pregnancy])

  const deleteMutation = useMutation({
    mutationFn: () => pregnancyService.deletePregnancy(id ?? ''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pregnancies'] })
      addToast('success', 'Pregnancy record deleted.')
      navigate('/phc/maternal')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const confirmDelete = () => {
    if (window.confirm('Delete this pregnancy record? This cannot be undone.')) {
      deleteMutation.mutate()
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 md:ml-64 bg-background min-h-screen pb-24 md:pb-0 overflow-y-auto flex flex-col">
          <div className="p-6"><LoadingState label="Loading pregnancy details…" /></div>
        </main>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 md:ml-64 bg-background min-h-screen pb-24 md:pb-0 overflow-y-auto flex flex-col">
          <div className="p-6"><ErrorState message={getErrorMessage(error)} onRetry={refetch} /></div>
        </main>
      </div>
    )
  }

  if (!pregnancy) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 md:ml-64 bg-background min-h-screen pb-24 md:pb-0 overflow-y-auto flex flex-col">
          <div className="p-6"><EmptyState title="Pregnancy not found" icon="pregnant_woman" /></div>
        </main>
      </div>
    )
  }

  const week = weekFromLmp(pregnancy.lmp)
  const age = beneficiary ? ageFromDob(beneficiary.dob) : null
  const hrp = pregnancy.hrpLevel ?? (pregnancy.highRisk ? 'high' : 'low')

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 md:ml-64 bg-background min-h-screen pb-24 md:pb-0 overflow-y-auto flex flex-col">
        <div className="max-w-[1440px] mx-auto p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <a href="/phc/maternal" className="flex items-center gap-1 hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              <span className="text-sm">Back to Directory</span>
            </a>
          </div>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-display-lg font-bold shrink-0">
                {(beneficiary?.name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold text-on-surface">{beneficiary?.name ?? '—'}</h1>
                  <span className={`px-3 py-1 rounded-full text-label-md flex items-center gap-1 ${hrp === 'high' || hrp === 'medium' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'}`}>
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    {hrp === 'high' || hrp === 'medium' ? 'High Risk' : 'Standard Risk'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 mt-2 text-on-surface-variant text-body-md">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">id_card</span> ID: {pregnancy.id.replace(/-/g, '').slice(0, 6).toUpperCase()}</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">cake</span> {age != null ? `${age} Years` : '—'}</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">home</span> {beneficiary?.village ?? '—'}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button className="border border-primary text-primary px-4 py-2 rounded-full font-label-md hover:bg-primary hover:text-on-primary transition-colors h-12 flex items-center justify-center gap-1 w-full sm:w-auto">
                <span className="material-symbols-outlined">edit</span>
                Edit Profile
              </button>
              <button className="bg-error text-on-error px-4 py-2 rounded-full font-label-md hover:opacity-90 transition-opacity h-12 flex items-center justify-center gap-1 w-full sm:w-auto shadow-sm">
                <span className="material-symbols-outlined">local_hospital</span>
                Refer Patient
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="border border-error text-error px-4 py-2 rounded-full font-label-md hover:bg-error-container/40 transition-colors h-12 flex items-center justify-center gap-1 w-full sm:w-auto disabled:opacity-50"
              >
                <span className="material-symbols-outlined">delete</span>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant shadow-sm border-l-4 border-l-primary flex flex-col justify-center">
              <p className="text-caption text-on-surface-variant mb-1">Expected Delivery (EDD)</p>
              <p className="text-2xl font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">calendar_month</span>
                {formatDate(pregnancy.edd)}
              </p>
            </div>
            <div className={`bg-surface-container-lowest p-4 rounded-lg border border-outline-variant shadow-sm ${hrp === 'high' || hrp === 'medium' ? 'border-l-4 border-l-error' : 'border-l-4 border-l-primary'} flex flex-col justify-center`}>
              <p className="text-caption text-on-surface-variant mb-1">Gestational Age</p>
              <p className={`text-2xl font-semibold flex items-center gap-2 ${hrp === 'high' || hrp === 'medium' ? 'text-error' : 'text-on-surface'}`}>
                <span className="material-symbols-outlined">pregnant_woman</span>
                {week > 0 ? `${week} Weeks` : '—'}
              </p>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant shadow-sm flex flex-col justify-center">
              <p className="text-caption text-on-surface-variant mb-1">Status</p>
              <p className="text-2xl font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary">bloodtype</span>
                {pregnancy.status.charAt(0).toUpperCase() + pregnancy.status.slice(1)}
              </p>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant shadow-sm flex flex-col justify-center">
              <p className="text-caption text-on-surface-variant mb-1">Gravida / Para</p>
              <p className="text-2xl font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">family_restroom</span>
                G{pregnancy.gravida || '—'} P{pregnancy.para || '—'}
              </p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col min-h-[400px]">
            <div className="p-5 border-b border-outline-variant flex justify-between items-center">
              <h2 className="text-xl font-semibold text-on-surface">Antenatal Care Schedule</h2>
            </div>
            <div className="p-6 flex-1 flex flex-col gap-4 bg-surface-container-lowest">
              {visitsLoading ? (
                <LoadingState label="Loading ANC visits…" />
              ) : visitsError ? (
                <ErrorState message={getErrorMessage(visitsErrorObj)} onRetry={visitsRefetch} />
              ) : (visits ?? []).length === 0 ? (
                <EmptyState title="No ANC visits recorded" icon="pregnant_woman" />
              ) : (
                <div className="relative border-l-2 border-surface-variant ml-3 space-y-6 pb-2">
                  {(visits ?? []).map((v) => (
                    <div key={v.id} className="relative pl-5">
                      <span className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-secondary text-on-secondary flex items-center justify-center border-4 border-surface-container-lowest">
                        <span className="material-symbols-outlined text-[12px]">check</span>
                      </span>
                      <div className="bg-surface rounded-lg p-4 border border-outline-variant">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-label-md text-on-surface">ANC {v.visitNumber}{v.gestationWeek > 0 ? ` - ${v.gestationWeek} Weeks` : ''}</h3>
                            <p className="text-caption text-on-surface-variant">{formatDate(v.date)}</p>
                          </div>
                          <span className="bg-secondary-container text-on-secondary-container px-2 py-1 rounded text-caption">Completed</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                          <div>
                            <p className="text-caption text-outline">Blood Pressure</p>
                            <p className="text-body-md font-semibold text-on-surface">{(v.bpSystolic != null && v.bpDiastolic != null) ? `${v.bpSystolic}/${v.bpDiastolic} mmHg` : '—'}</p>
                          </div>
                          <div>
                            <p className="text-caption text-outline">Weight</p>
                            <p className="text-body-md text-on-surface">{v.weightKg != null ? `${v.weightKg} kg` : '—'}</p>
                          </div>
                          <div>
                            <p className="text-caption text-outline">Hb Level</p>
                            <p className="text-body-md text-on-surface">{v.haemoglobin != null ? `${v.haemoglobin} g/dL` : '—'}</p>
                          </div>
                          <div>
                            <p className="text-caption text-outline">FHR</p>
                            <p className="text-body-md text-on-surface">{v.foetalHeartRate != null ? `${v.foetalHeartRate} bpm` : '—'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
