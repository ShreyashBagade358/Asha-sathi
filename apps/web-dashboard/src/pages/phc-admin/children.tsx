import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { childService } from '@/services/child.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { vaccinationService } from '@/services/vaccination.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import type { ChildHealthStatus } from '@/pages/asha/mockData'

function initials(name: string) {
  return (name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function ageMonthsFromDob(iso?: string): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (30.44 * 86400000)))
}

function nutritionBadge(_status: ChildHealthStatus) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-label-sm font-semibold">
      — Not available
    </span>
  )
}

function vaxBadge(done: number, total: number, overdue: boolean) {
  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container text-caption font-semibold">
        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span> {done}/{total} doses · Overdue
      </span>
    )
  }
  if (total > 0 && done >= total) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-caption font-semibold">
        <span className="material-symbols-outlined text-[12px]">check_circle</span> {done}/{total} doses
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container text-caption font-semibold">
      <span className="material-symbols-outlined text-[12px]">vaccines</span> {done}/{total} doses
    </span>
  )
}

export default function ChildrenDirectoryPhcAdmin() {
  const [search, setSearch] = useState('')
  const [village, setVillage] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [vaxStatus, setVaxStatus] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 8

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['children', page],
    queryFn: () => childService.listChildren({ page, pageSize }),
  })

  const { data: benData } = useQuery({
    queryKey: ['beneficiaries-map'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })

  const childIds = (data?.items ?? []).map((c) => c.id)

  const immunizationQueries = useQueries({
    queries: childIds.map((id) => ({
      queryKey: ['child-immunizations', id] as const,
      queryFn: () => childService.listImmunizations(id),
      enabled: !!id,
    })),
  })

  const { data: dueVaccinations } = useQuery({
    queryKey: ['vaccination-due'],
    queryFn: () => vaccinationService.getDueVaccinations(),
  })

  const immunizationsByChild = new Map<string, { given: number; total: number; overdue: boolean }>()
  childIds.forEach((id, i) => {
    const imms = immunizationQueries[i]?.data
    if (!imms) return
    immunizationsByChild.set(id, {
      given: imms.filter((im) => im.status === 'given').length,
      total: imms.length,
      overdue: imms.some((im) => im.status === 'overdue'),
    })
  })

  const beneficiaryMap = useMemo(() => {
    const m = new Map<string, { name: string; village: string; dob: string }>()
    for (const b of benData?.items ?? []) {
      m.set(b.id, { name: b.name, village: b.village, dob: b.dob })
    }
    return m
  }, [benData])

  const children = (data?.items ?? []).map((c) => {
    const ben = beneficiaryMap.get(c.beneficiary_id)
    const motherName = c.mother_name ?? (c.mother_id ? beneficiaryMap.get(c.mother_id)?.name : null)
    const vax = immunizationsByChild.get(c.id)
    return {
      id: c.id,
      beneficiaryId: c.beneficiary_id,
      name: ben?.name ?? 'Child',
      parentName: motherName ?? '—',
      village: ben?.village ?? '—',
      status: 'healthy' as ChildHealthStatus,
      ageMonths: ageMonthsFromDob(ben?.dob),
      immunizationDone: vax?.given ?? 0,
      immunizationTotal: vax?.total ?? 0,
      vaxOverdue: vax?.overdue ?? false,
    }
  })

  const villages = Array.from(new Set(children.map((c) => c.village).filter((v) => v && v !== '—')))

  const counts = (() => {
    const total = data?.total ?? 0
    return { total, malnourished: 0, vaxDue: (dueVaccinations ?? []).length, healthy: total }
  })()

  const childrenList = (() => {
    let items = children.filter((c) => {
      if (village && c.village !== village) return false
      if (ageGroup) {
        const m = c.ageMonths
        if (m == null) return false
        if (ageGroup === '0-6' && !(m < 6)) return false
        if (ageGroup === '6-24' && !(m >= 6 && m < 24)) return false
        if (ageGroup === '2-5y' && !(m >= 24 && m < 60)) return false
      }
      if (vaxStatus) {
        const upToDate = c.immunizationTotal > 0 && c.immunizationDone >= c.immunizationTotal && !c.vaxOverdue
        if (vaxStatus === 'up-to-date' && !upToDate) return false
        if (vaxStatus === 'due' && upToDate) return false
      }
      if (search) {
        const q = search.toLowerCase()
        return c.name.toLowerCase().includes(q) || c.parentName.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
      }
      return true
    })
    const filteredCount = items.length
    const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize))
    items = items.slice((page - 1) * pageSize, page * pageSize)
    return { items, totalPages, filteredCount }
  })()

  const resetFilters = () => {
    setSearch('')
    setVillage('')
    setAgeGroup('')
    setVaxStatus('')
    setPage(1)
  }

  return (
      <div className="flex flex-col gap-6">
        <div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
              <span className="text-label-md text-on-surface-variant">Total Children</span>
              <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                <span className="material-symbols-outlined text-[20px]">face</span>
              </div>
            </div>
            <div className="text-display-lg text-on-surface font-display-lg">{counts.total}</div>
            <div className="text-caption text-secondary mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              Across {villages.length} villages
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
            <div className="flex justify-between items-start mb-3">
              <span className="text-label-md text-on-surface-variant">Malnourished</span>
              <div className="bg-error-container text-on-error-container p-2 rounded-lg">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              </div>
            </div>
            <div className="text-display-lg font-display-lg text-error">{counts.malnourished}</div>
            <div className="text-caption text-on-surface-variant mt-1">Requires follow-up</div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
              <span className="text-label-md text-on-surface-variant">Vaccinations Due</span>
              <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                <span className="material-symbols-outlined text-[20px]">vaccines</span>
              </div>
            </div>
            <div className="text-display-lg text-on-surface font-display-lg">{counts.vaxDue}</div>
            <div className="text-caption text-on-surface-variant mt-1">Immunization incomplete</div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
              <span className="text-label-md text-on-surface-variant">Healthy</span>
              <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
              </div>
            </div>
            <div className="text-display-lg text-on-surface font-display-lg">{counts.healthy}</div>
            <div className="text-caption text-on-surface-variant mt-1">On track</div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <div className="p-4 border-b border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="text-headline-sm text-on-surface font-semibold">All Children</h3>
            {isLoading ? <LoadingState label="Loading children…" /> : isError ? <ErrorState message={getErrorMessage(error)} onRetry={refetch} /> : (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                  <input
                    className="w-full sm:w-56 h-9 pl-9 pr-3 bg-surface-container rounded-lg border-none text-body-md text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary shadow-sm"
                    placeholder="Search children..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  />
                </div>
                <select
                  className="h-9 px-3 bg-surface-container rounded-lg border-none text-body-md text-on-surface focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                  value={village}
                  onChange={(e) => { setVillage(e.target.value); setPage(1) }}
                >
                  <option value="">All Villages</option>
                  {villages.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                <select
                  className="h-9 px-3 bg-surface-container rounded-lg border-none text-body-md text-on-surface focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                  value={ageGroup}
                  onChange={(e) => { setAgeGroup(e.target.value); setPage(1) }}
                >
                  <option value="">All Ages</option>
                  <option value="0-6">0–6 months</option>
                  <option value="6-24">6–24 months</option>
                  <option value="2-5y">2–5 years</option>
                </select>
                <select
                  className="h-9 px-3 bg-surface-container rounded-lg border-none text-body-md text-on-surface focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                  value={vaxStatus}
                  onChange={(e) => { setVaxStatus(e.target.value); setPage(1) }}
                >
                  <option value="">All Vaccination</option>
                  <option value="up-to-date">Up to date</option>
                  <option value="due">Due soon</option>
                </select>
                {(search || village || ageGroup || vaxStatus) && (
                  <button onClick={resetFilters} className="h-9 px-3 rounded-lg border border-outline-variant text-on-surface-variant text-body-md hover:bg-surface-container transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 border-b border-outline-variant">
                  <th className="p-3 px-4 text-label-md text-on-surface-variant font-medium">Child</th>
                  <th className="p-3 text-label-md text-on-surface-variant font-medium">Age</th>
                  <th className="p-3 text-label-md text-on-surface-variant font-medium">Mother</th>
                  <th className="p-3 text-label-md text-on-surface-variant font-medium">Village</th>
                  <th className="p-3 text-label-md text-on-surface-variant font-medium text-center">Nutrition</th>
                  <th className="p-3 text-label-md text-on-surface-variant font-medium text-center">Vaccination</th>
                  <th className="p-3 text-label-md text-on-surface-variant font-medium text-right px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {childrenList.items.map((child, idx) => (
                  <tr key={child.id} className={`hover:bg-surface-container-low transition-colors h-14 ${idx % 2 === 0 ? 'bg-surface' : 'bg-surface-container-low'}`}>
                    <td className="p-3 px-4">
                      <Link to={`/phc/children/${child.id}`} className="flex items-center gap-3 group">
                        <div className="relative shrink-0">
                          <div className={`w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md font-bold`}>
                            {initials(child.name)}
                          </div>
                        </div>
                        <div>
                          <div className="text-body-md text-on-surface font-medium group-hover:text-primary transition-colors">{child.name}</div>
                          <div className="text-caption text-on-surface-variant">{child.id.replace(/-/g, '').slice(0, 6).toUpperCase()}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="p-3 text-body-md text-on-surface font-medium">{child.ageMonths != null ? (child.ageMonths >= 24 ? `${Math.floor(child.ageMonths / 12)} yr` : `${child.ageMonths} mo`) : '—'}</td>
                    <td className="p-3 text-body-md text-on-surface-variant">{child.parentName}</td>
                    <td className="p-3 text-body-md text-on-surface-variant">{child.village}</td>
                    <td className="p-3 text-center">{nutritionBadge(child.status)}</td>
                    <td className="p-3 text-center">{vaxBadge(child.immunizationDone, child.immunizationTotal, child.vaxOverdue)}</td>
                    <td className="p-3 px-4 text-right">
                      <Link to={`/phc/children/${child.id}`} className="p-1.5 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container transition-colors inline-flex">
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </Link>
                    </td>
                  </tr>
                ))}
                {childrenList.items.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <span className="material-symbols-outlined text-[48px] text-outline mb-3 block">child_care</span>
                      <p className="text-body-lg text-on-surface-variant">No children found.</p>
                      <button onClick={resetFilters} className="mt-3 text-primary text-label-md hover:underline">Clear filters</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-outline-variant bg-surface flex justify-between items-center">
            <span className="text-[13px] text-on-surface-variant pl-1">
              Showing {childrenList.items.length} of {childrenList.filteredCount} children
            </span>
            <div className="flex items-center gap-1">
              <button
                className="p-1 rounded border border-outline-variant text-outline hover:bg-surface-container disabled:opacity-50 transition-colors"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <span className="text-label-md text-on-surface-variant px-2">
                {page} / {childrenList.totalPages}
              </span>
              <button
                className="p-1 rounded border border-outline-variant text-outline hover:bg-surface-container disabled:opacity-50 transition-colors"
                disabled={page >= childrenList.totalPages}
                onClick={() => setPage((p) => Math.min(childrenList.totalPages, p + 1))}
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>
  )
}

