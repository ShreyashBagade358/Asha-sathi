import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { childService } from '@/services/child.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { useUIStore } from '@/stores/ui.store'

function ageFromDob(iso: string): { months: number; label: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const months = Math.max(0, Math.floor((now.getTime() - d.getTime()) / (30.44 * 86400000)))
  return { months, label: months >= 24 ? `${Math.floor(months / 12)} Years (${months} Months)` : `${months} Months` }
}

export default function ChildProfilePhcAdmin() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { addToast } = useUIStore()

  const { data: child, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['child', id],
    queryFn: () => childService.getChild(id ?? ''),
    enabled: !!id,
  })

  const { data: immunizations } = useQuery({
    queryKey: ['child-immunizations', id],
    queryFn: () => childService.listImmunizations(id ?? ''),
    enabled: !!id,
  })

  const { data: growthRecords } = useQuery({
    queryKey: ['child-growth', id],
    queryFn: () => childService.listGrowthRecords(id ?? ''),
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

  const deleteMutation = useMutation({
    mutationFn: () => childService.deleteChild(id ?? ''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['children'] })
      addToast('success', 'Child record deleted.')
      navigate('/phc/children')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const confirmDelete = () => {
    if (window.confirm('Delete this child record? This cannot be undone.')) {
      deleteMutation.mutate()
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-4 md:p-6 pb-24 md:pb-0 overflow-y-auto"><LoadingState label="Loading child profile…" /></main>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-4 md:p-6 pb-24 md:pb-0 overflow-y-auto"><ErrorState message={getErrorMessage(error)} onRetry={refetch} /></main>
      </div>
    )
  }

  if (!child) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-4 md:p-6 pb-24 md:pb-0 overflow-y-auto"><EmptyState title="Child not found" icon="child_care" /></main>
      </div>
    )
  }

  const age = ageFromDob(child.dob)
  const givenCount = (immunizations ?? []).filter((i) => i.status === 'given').length
  const totalCount = (immunizations ?? []).length
  const onTrack = totalCount > 0 && givenCount >= totalCount
  const growthPhotos = (growthRecords ?? []).filter((r) => r.photoUrl)

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="ml-0 md:ml-64 flex-1 pb-24 px-4 md:px-6 md:pb-0 overflow-y-auto max-w-7xl mx-auto w-full flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between gap-4 mt-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-surface-container-high bg-primary-container text-on-primary-container flex items-center justify-center text-2xl font-bold shrink-0">
              {(beneficiary?.name ?? 'C').charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-on-surface mb-1">{beneficiary?.name ?? 'Child'}</h1>
              <div className="flex flex-wrap items-center gap-2 text-body-md text-on-surface-variant">
                <span>{child.gender}, {age ? age.label : '—'}</span>
                <span className="w-1 h-1 bg-outline rounded-full"></span>
                <span>ID: CH-{child.id.replace(/-/g, '').slice(0, 6).toUpperCase()}</span>
              </div>
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-label-md border border-secondary/20 shadow-sm`}>
                  <span className="material-symbols-outlined text-[16px]">check_circle</span> Record on File
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 md:flex-none h-12 flex items-center justify-center gap-1 bg-surface-container border border-outline-variant text-primary px-4 rounded-lg hover:bg-surface-container-high transition-colors shadow-sm">
              <span className="material-symbols-outlined">edit</span>
              Edit
            </button>
            <button className="flex-1 md:flex-none h-12 flex items-center justify-center gap-1 bg-primary text-on-primary px-4 rounded-lg hover:opacity-90 transition-opacity shadow-sm">
              <span className="material-symbols-outlined">add_task</span>
              Log Visit
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="flex-1 md:flex-none h-12 flex items-center justify-center gap-1 border border-error text-error px-4 rounded-lg hover:bg-error-container/40 transition-colors shadow-sm disabled:opacity-50"
            >
              <span className="material-symbols-outlined">delete</span>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 md:p-5 border-b border-outline-variant bg-surface-bright flex justify-between items-center">
              <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">child_friendly</span>
                Birth & Health Details
              </h2>
            </div>
            <div className="p-4 md:p-5 flex-1 flex flex-col gap-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-surface-container p-3 rounded-lg border border-outline-variant">
                  <div className="text-caption text-on-surface-variant mb-1">Birth Weight</div>
                  <div className="text-2xl font-bold text-on-surface">{child.birthWeightKg != null ? `${child.birthWeightKg} kg` : '—'}</div>
                </div>
                <div className="bg-surface-container p-3 rounded-lg border border-outline-variant">
                  <div className="text-caption text-on-surface-variant mb-1">Gestational Age</div>
                  <div className="text-2xl text-on-surface font-bold">{child.gestationalAgeWeeks != null ? `${child.gestationalAgeWeeks} wks` : '—'}</div>
                </div>
                <div className="bg-surface-container p-3 rounded-lg border border-outline-variant">
                  <div className="text-caption text-on-surface-variant mb-1">Delivery Type</div>
                  <div className="text-2xl text-on-surface font-bold capitalize">{child.deliveryType.replace('-', ' ')}</div>
                </div>
                <div className="bg-surface-container p-3 rounded-lg border border-outline-variant">
                  <div className="text-caption text-on-surface-variant mb-1">Born at Facility</div>
                  <div className="text-2xl text-on-surface font-bold">{child.bornAtFacility ? 'Yes' : 'No'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-outline-variant bg-surface-bright">
              <h2 className="text-lg font-semibold text-on-surface">Vaccination</h2>
            </div>
            <div className="p-4 flex flex-col gap-3 flex-1 bg-surface">
              <div className="flex justify-between items-center bg-surface-bright p-3 rounded border border-outline-variant border-l-4 border-l-primary">
                <div>
                  <div className="text-label-md text-on-surface">Immunization Progress</div>
                  <div className="text-caption text-on-surface-variant">{totalCount > 0 ? `${givenCount} of ${totalCount} doses given` : 'No immunizations recorded'}</div>
                </div>
                <span className={`px-2 py-1 rounded-full text-caption font-semibold ${onTrack ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-container text-on-tertiary-container'}`}>
                  {onTrack ? 'On Track' : 'In Progress'}
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-6 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-surface-bright">
              <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">family_home</span>
                Household Information
              </h2>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-caption text-on-surface-variant mb-1">Mother's Name</div>
                <div className="text-body-md text-on-surface font-semibold">{beneficiary?.name ?? '—'}</div>
                <div className="text-caption text-primary flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-[14px]">call</span> {beneficiary?.phone ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-caption text-on-surface-variant mb-1">Father's Name</div>
                <div className="text-body-md text-on-surface">—</div>
              </div>
              <div className="md:col-span-2 mt-2 pt-2 border-t border-outline-variant">
                <div className="text-caption text-on-surface-variant mb-1">Address</div>
                <div className="text-body-md text-on-surface flex items-start gap-1">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px] mt-0.5">location_on</span>
                  {beneficiary?.village ?? '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-6 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-surface-bright">
              <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">assignment_ind</span>
                Program Details
              </h2>
            </div>
            <div className="p-4 flex flex-col gap-2">
              <div className="flex justify-between items-center py-1 border-b border-outline-variant/50">
                <span className="text-body-md text-on-surface-variant">Birth Weight</span>
                <span className="text-body-md text-on-surface font-semibold">{child.birthWeightKg != null ? `${child.birthWeightKg} kg` : '—'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-body-md text-on-surface-variant">Record ID</span>
                <span className="text-body-md text-on-surface">{child.id.replace(/-/g, '').slice(0, 8).toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-12 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-surface-bright flex justify-between items-center">
              <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">photo_library</span>
                Growth Photo History
              </h2>
              <span className="text-caption text-on-surface-variant">{growthPhotos.length} photo{growthPhotos.length === 1 ? '' : 's'}</span>
            </div>
            <div className="p-4">
              {growthPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <span className="material-symbols-outlined text-[36px] text-outline">photo_camera</span>
                  <p className="text-body-md text-on-surface-variant">No baby progress photos captured yet.</p>
                  <p className="text-caption text-on-surface-variant">Photos attached to growth measurements appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {growthPhotos.map((r) => (
                    <figure key={r.id} className="rounded-lg overflow-hidden border border-outline-variant bg-surface-container-low">
                      <a href={r.photoUrl} target="_blank" rel="noreferrer" className="block">
                        <img src={r.photoUrl} alt={`Growth photo ${r.recordDate}`} className="w-full h-28 object-cover hover:opacity-90 transition-opacity" />
                      </a>
                      <figcaption className="px-2 py-1.5 text-caption text-on-surface-variant">{r.recordDate}</figcaption>
                    </figure>
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
