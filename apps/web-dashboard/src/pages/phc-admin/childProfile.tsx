import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { childService } from '@/services/child.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { useUIStore } from '@/stores/ui.store'
import { vaccinationService } from '@/services/vaccination.service'

function ageFromDob(iso: string): { months: number; label: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const months = Math.max(0, Math.floor((now.getTime() - d.getTime()) / (30.44 * 86400000)))
  return { months, label: months >= 24 ? `${Math.floor(months / 12)} Years (${months} Months)` : `${months} Months` }
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

type DoseChip = { label: string; className: string; icon: string }

const DOSE_CHIPS: Record<string, DoseChip> = {
  given: { label: 'Given', className: 'bg-secondary-container text-on-secondary-container', icon: 'check_circle' },
  due: { label: 'Due', className: 'bg-primary-container text-on-primary-container', icon: 'schedule' },
  overdue: { label: 'Overdue', className: 'bg-error-container text-on-error-container', icon: 'warning' },
  upcoming: { label: 'Upcoming', className: 'bg-surface-container-high text-on-surface-variant', icon: 'event_upcoming' },
  skipped: { label: 'Skipped', className: 'bg-surface-container-high text-on-surface-variant', icon: 'skip_next' },
}

function doseChip(status: string): DoseChip {
  return DOSE_CHIPS[status] ?? DOSE_CHIPS.upcoming
}

interface DoseRow {
  key: string
  vaccineName: string
  doseNumber: number
  status: string
  date: string
}

function doseRowsFromStatusApi(byDose: { vaccine_code: string; vaccine_name: string; dose_number: number; due_date: string | null; given_date: string | null; effective_status: string; status: string }[]): DoseRow[] {
  return byDose.map((d) => ({
    key: `${d.vaccine_code}-${d.dose_number}`,
    vaccineName: d.vaccine_name || d.vaccine_code,
    doseNumber: d.dose_number,
    status: d.effective_status || d.status,
    date: d.given_date ?? d.due_date ?? '',
  }))
}

function doseRowsFromImmunizations(imms: { id: string; vaccineName: string; doseNumber: number; status: string; dueDate: string; administeredDate?: string }[]): DoseRow[] {
  const today = new Date().toISOString().slice(0, 10)
  return imms.map((im) => {
    let status = im.status
    if (status === 'due' && im.dueDate && im.dueDate.slice(0, 10) < today) status = 'overdue'
    return {
      key: im.id,
      vaccineName: im.vaccineName,
      doseNumber: im.doseNumber,
      status,
      date: im.administeredDate ?? im.dueDate ?? '',
    }
  })
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

  const { data: vaxStatus } = useQuery({
    queryKey: ['child-vaccination-status', id],
    queryFn: () => vaccinationService.getChildVaccinationStatus(id ?? ''),
    enabled: !!id,
    retry: false,
  })

  const { data: growthRecords } = useQuery({
    queryKey: ['child-growth', id],
    queryFn: () => childService.listGrowthRecords(id ?? ''),
    enabled: !!id,
  })

  const { data: hbncVisits } = useQuery({
    queryKey: ['child-hbnc', id],
    queryFn: () => childService.listHBNCVisits(id ?? ''),
    enabled: !!id,
  })

  const { data: hbycVisits } = useQuery({
    queryKey: ['child-hbyc', id],
    queryFn: () => childService.listHBYCVisits(id ?? ''),
    enabled: !!id,
  })

  const [homeForm, setHomeForm] = useState<'hbnc' | 'hbyc' | null>(null)
  const [hbncForm, setHbncForm] = useState({ visitDate: '', weightGrams: '', breastfeedingStatus: 'exclusive', cordCondition: 'dry' })
  const [hbycForm, setHbycForm] = useState({ visitDate: '', weightKg: '', heightCm: '', muacMm: '', nutritionStatus: 'normal' })

  const addHbncMutation = useMutation({
    mutationFn: () => childService.addHBNCVisit(id ?? '', {
      visitDate: hbncForm.visitDate,
      weightGrams: hbncForm.weightGrams ? Number(hbncForm.weightGrams) : undefined,
      breastfeedingStatus: hbncForm.breastfeedingStatus,
      cordCondition: hbncForm.cordCondition,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['child-hbnc', id] })
      setHomeForm(null)
      setHbncForm({ visitDate: '', weightGrams: '', breastfeedingStatus: 'exclusive', cordCondition: 'dry' })
      addToast('success', 'Newborn home visit recorded.')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const addHbycMutation = useMutation({
    mutationFn: () => childService.addHBYCVisit(id ?? '', {
      visitDate: hbycForm.visitDate,
      weightKg: hbycForm.weightKg ? Number(hbycForm.weightKg) : undefined,
      heightCm: hbycForm.heightCm ? Number(hbycForm.heightCm) : undefined,
      muacMm: hbycForm.muacMm ? Number(hbycForm.muacMm) : undefined,
      nutritionStatus: hbycForm.nutritionStatus,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['child-hbyc', id] })
      setHomeForm(null)
      setHbycForm({ visitDate: '', weightKg: '', heightCm: '', muacMm: '', nutritionStatus: 'normal' })
      addToast('success', 'Young child home visit recorded.')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const { data: benData } = useQuery({
    queryKey: ['beneficiaries-map'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })

  const beneficiary = useMemo(() => {
    if (!child) return undefined
    return benData?.items?.find((b) => b.id === child.beneficiaryId)
  }, [benData, child])

  const mother = useMemo(() => {
    if (!child?.motherId) return undefined
    return benData?.items?.find((b) => b.id === child.motherId)
  }, [benData, child])

  const father = useMemo(() => {
    if (!child?.fatherId) return undefined
    return benData?.items?.find((b) => b.id === child.fatherId)
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
        <div className="flex items-center justify-center py-24">
          <LoadingState label="Loading child profile…" />
        </div>
    )
  }

  if (isError) {
    return (
        <div className="flex items-center justify-center py-24">
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        </div>
    )
  }

  if (!child) {
    return (
        <div className="flex items-center justify-center py-24">
          <EmptyState title="Child not found" icon="child_care" />
        </div>
    )
  }

  const age = ageFromDob(child.dob)
  const givenCount = vaxStatus?.given ?? (immunizations ?? []).filter((i) => i.status === 'given').length
  const totalCount = vaxStatus?.total ?? (immunizations ?? []).length
  const progressPct = vaxStatus?.progress_pct ?? (totalCount > 0 ? Math.round((givenCount / totalCount) * 100) : 0)
  const fullyImmunized = vaxStatus ? vaxStatus.fully_immunized : totalCount > 0 && givenCount >= totalCount
  const hasOverdue = vaxStatus ? vaxStatus.overdue > 0 : (immunizations ?? []).some((i) => i.status === 'overdue')
  const doseRows: DoseRow[] = vaxStatus
    ? doseRowsFromStatusApi(vaxStatus.by_dose)
    : doseRowsFromImmunizations(immunizations ?? [])
  const nextDue = vaxStatus?.next_due
    ?? (() => {
      const upcoming = (immunizations ?? [])
        .filter((i) => i.status !== 'given' && i.dueDate)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
      return upcoming
        ? { vaccine_name: upcoming.vaccineName, dose_number: upcoming.doseNumber, due_date: upcoming.dueDate }
        : null
    })()
  const statusPill = hasOverdue
    ? { label: 'Overdue', className: 'bg-error-container text-on-error-container' }
    : fullyImmunized
      ? { label: 'On Track', className: 'bg-secondary-container text-on-secondary-container' }
      : { label: 'In Progress', className: 'bg-tertiary-container text-on-tertiary-container' }
  const growthPhotos = (growthRecords ?? []).filter((r) => r.photoUrl)

  return (
      <div className="mx-auto w-full max-w-7xl flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between gap-4 mt-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-surface-container-high bg-primary-container text-on-primary-container flex items-center justify-center text-2xl font-bold shrink-0">
              {(beneficiary?.name ?? 'C').charAt(0).toUpperCase()}
            </div>
            <div>
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
            <div className="p-4 border-b border-outline-variant bg-surface-bright flex justify-between items-center">
              <h2 className="text-lg font-semibold text-on-surface">Vaccination</h2>
              <Link to={`/phc/children/${id}/vaccination`} className="text-label-md text-primary hover:underline flex items-center gap-1">
                Full schedule
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            </div>
            <div className="p-4 flex flex-col gap-3 flex-1 bg-surface">
              <div className="flex justify-between items-center bg-surface-bright p-3 rounded border border-outline-variant border-l-4 border-l-primary">
                <div>
                  <div className="text-label-md text-on-surface">Immunization Progress</div>
                  <div className="text-caption text-on-surface-variant">{totalCount > 0 ? `${givenCount} of ${totalCount} doses given` : 'No immunizations recorded'}</div>
                </div>
                <span className={`px-2 py-1 rounded-full text-caption font-semibold ${statusPill.className}`}>
                  {statusPill.label}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-surface-container-high rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${hasOverdue ? 'bg-error' : fullyImmunized ? 'bg-secondary' : 'bg-tertiary'}`}
                    style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                  />
                </div>
                <span className="text-caption text-on-surface-variant font-medium">{progressPct}%</span>
              </div>

              {nextDue ? (
                <div className="flex items-center gap-2 bg-primary-container/40 border border-primary/20 rounded-lg px-3 py-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">event_upcoming</span>
                  <div className="min-w-0">
                    <div className="text-caption text-on-surface-variant">Next Due</div>
                    <div className="text-label-md text-on-surface truncate">
                      {nextDue.vaccine_name} · Dose {nextDue.dose_number} · {formatDate(nextDue.due_date)}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-1">
                <h3 className="text-label-md text-on-surface mb-2">Dose Schedule</h3>
                {doseRows.length === 0 ? (
                  <p className="text-body-md text-on-surface-variant">No doses recorded yet.</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto flex flex-col gap-1.5 pr-1">
                    {doseRows.map((row) => {
                      const chip = doseChip(row.status)
                      return (
                        <div key={row.key} className="flex items-center justify-between gap-2 bg-surface-bright border border-outline-variant/60 rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-label-md text-on-surface truncate">{row.vaccineName}</div>
                            <div className="text-caption text-on-surface-variant">Dose {row.doseNumber} · {formatDate(row.date)}</div>
                          </div>
                          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold ${chip.className}`}>
                            <span className="material-symbols-outlined text-[12px]">{chip.icon}</span>
                            {chip.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
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
                <div className="text-body-md text-on-surface font-semibold">{child?.motherName ?? mother?.name ?? '—'}</div>
                <div className="text-caption text-primary flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-[14px]">call</span> {mother?.phone ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-caption text-on-surface-variant mb-1">Father's Name</div>
                <div className="text-body-md text-on-surface font-semibold">{child?.fatherName ?? father?.name ?? '—'}</div>
                {father?.phone ? (
                  <div className="text-caption text-primary flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[14px]">call</span> {father.phone}
                  </div>
                ) : null}
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

          <div className="md:col-span-12 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-surface-bright flex justify-between items-center">
              <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">home_health</span>
                Home Visits
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setHomeForm(homeForm === 'hbnc' ? null : 'hbnc')}
                  className={`px-3 py-1.5 rounded-full text-label-md transition-opacity ${homeForm === 'hbnc' ? 'bg-primary text-on-primary' : 'bg-secondary-container text-on-secondary-container hover:opacity-90'}`}
                >
                  Newborn Care Visit
                </button>
                <button
                  onClick={() => setHomeForm(homeForm === 'hbyc' ? null : 'hbyc')}
                  className={`px-3 py-1.5 rounded-full text-label-md transition-opacity ${homeForm === 'hbyc' ? 'bg-primary text-on-primary' : 'bg-secondary-container text-on-secondary-container hover:opacity-90'}`}
                >
                  Young Child Visit
                </button>
              </div>
            </div>
            {homeForm === 'hbnc' ? (
              <div className="p-4 border-b border-outline-variant bg-surface-container-low grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                <label className="text-caption text-on-surface-variant">Visit date *
                  <input type="date" value={hbncForm.visitDate} onChange={(e) => setHbncForm({ ...hbncForm, visitDate: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" />
                </label>
                <label className="text-caption text-on-surface-variant">Weight (g)
                  <input type="number" value={hbncForm.weightGrams} onChange={(e) => setHbncForm({ ...hbncForm, weightGrams: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" placeholder="2800" />
                </label>
                <label className="text-caption text-on-surface-variant">Breastfeeding
                  <select value={hbncForm.breastfeedingStatus} onChange={(e) => setHbncForm({ ...hbncForm, breastfeedingStatus: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface">
                    <option value="exclusive">Exclusive</option>
                    <option value="partial">Partial</option>
                    <option value="none">None</option>
                  </select>
                </label>
                <label className="text-caption text-on-surface-variant">Cord condition
                  <select value={hbncForm.cordCondition} onChange={(e) => setHbncForm({ ...hbncForm, cordCondition: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface">
                    <option value="dry">Dry</option>
                    <option value="inflamed">Inflamed</option>
                    <option value="discharging">Discharging</option>
                  </select>
                </label>
                <button
                  onClick={() => addHbncMutation.mutate()}
                  disabled={!hbncForm.visitDate || addHbncMutation.isPending}
                  className="bg-primary text-on-primary px-4 py-2 rounded-full text-label-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {addHbncMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : null}
            {homeForm === 'hbyc' ? (
              <div className="p-4 border-b border-outline-variant bg-surface-container-low grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                <label className="text-caption text-on-surface-variant">Visit date *
                  <input type="date" value={hbycForm.visitDate} onChange={(e) => setHbycForm({ ...hbycForm, visitDate: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" />
                </label>
                <label className="text-caption text-on-surface-variant">Weight (kg)
                  <input type="number" step="0.1" value={hbycForm.weightKg} onChange={(e) => setHbycForm({ ...hbycForm, weightKg: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" />
                </label>
                <label className="text-caption text-on-surface-variant">Height (cm)
                  <input type="number" step="0.1" value={hbycForm.heightCm} onChange={(e) => setHbycForm({ ...hbycForm, heightCm: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" />
                </label>
                <label className="text-caption text-on-surface-variant">Mid-upper arm (mm)
                  <input type="number" value={hbycForm.muacMm} onChange={(e) => setHbycForm({ ...hbycForm, muacMm: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" placeholder="12" />
                </label>
                <label className="text-caption text-on-surface-variant">Nutrition
                  <select value={hbycForm.nutritionStatus} onChange={(e) => setHbycForm({ ...hbycForm, nutritionStatus: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface">
                    <option value="normal">Normal</option>
                    <option value="moderate_acute">Moderate acute</option>
                    <option value="severe_acute">Severe acute</option>
                    <option value="stunting">Stunting</option>
                  </select>
                </label>
                <button
                  onClick={() => addHbycMutation.mutate()}
                  disabled={!hbycForm.visitDate || addHbycMutation.isPending}
                  className="bg-primary text-on-primary px-4 py-2 rounded-full text-label-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {addHbycMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : null}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-label-md text-on-surface mb-2">Newborn care visits</h3>
                {(hbncVisits ?? []).length === 0 ? (
                  <p className="text-body-md text-on-surface-variant">No newborn home visits yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(hbncVisits ?? []).map((v) => (
                      <div key={v.id} className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface p-3">
                        <div>
                          <p className="text-body-md font-semibold text-on-surface">Visit {v.visit_number} · {v.visit_date}</p>
                        </div>
                        {v.referral_made ? <span className="bg-error-container text-on-error-container px-2 py-1 rounded text-caption">Referred</span> : <span className="bg-secondary-container text-on-secondary-container px-2 py-1 rounded text-caption">OK</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-label-md text-on-surface mb-2">Young child visits</h3>
                {(hbycVisits ?? []).length === 0 ? (
                  <p className="text-body-md text-on-surface-variant">No young child home visits yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(hbycVisits ?? []).map((v) => (
                      <div key={v.id} className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface p-3">
                        <div>
                          <p className="text-body-md font-semibold text-on-surface">Visit {v.visit_number} · {v.visit_date}</p>
                        </div>
                        {v.referral_made ? <span className="bg-error-container text-on-error-container px-2 py-1 rounded text-caption">Referred</span> : <span className="bg-secondary-container text-on-secondary-container px-2 py-1 rounded text-caption">OK</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}
