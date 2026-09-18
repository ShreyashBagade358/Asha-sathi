import { useMemo } from 'react'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { useQuery } from '@tanstack/react-query'
import { childService } from '@/services/child.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'

function ageLabel(dob: string): string {
  if (!dob) return '—'
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return '—'
  const months = Math.max(0, Math.floor((Date.now() - d.getTime()) / (30.44 * 86400000)))
  return months >= 24 ? `${Math.floor(months / 12)} Years Old (Born: ${d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit', year: 'numeric' })})` : `${months} Months Old (Born: ${d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit', year: 'numeric' })})`
}

export default function GrowthNutritionMonitoringPhcAdmin() {
  const { data: childrenData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['children', 'nutrition'],
    queryFn: () => childService.listChildren({ page: 1, pageSize: 1000 }),
  })

  const { data: benData } = useQuery({
    queryKey: ['beneficiaries-map'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })

  const beneficiaryMap = useMemo(() => {
    const m = new Map<string, { name: string; village: string }>()
    for (const b of benData?.items ?? []) {
      m.set(b.id, { name: b.name, village: b.village })
    }
    return m
  }, [benData])

  const children = (childrenData?.items ?? []).map((c) => {
    const ben = beneficiaryMap.get(c.beneficiary_id)
    return { id: c.id, name: ben?.name ?? '—', village: ben?.village ?? '—', dob: c.birth_registration_no ?? '' }
  })

  const child = children[0]

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto"><LoadingState label="Loading nutrition data…" /></main>
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
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-8 max-w-[1440px] mx-auto pb-24 md:pb-0 overflow-y-auto flex flex-col">
        {!child ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-14 text-center">
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant">monitor_weight</span>
            <p className="text-headline-md text-on-surface">No children available</p>
            <p className="max-w-md text-body-md text-on-surface-variant">Register children to view growth and nutrition monitoring.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-semibold text-on-surface mb-1">{child.name}</h2>
                <div className="flex flex-wrap items-center gap-2 text-on-surface-variant text-body-md">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">calendar_today</span> {ageLabel(child.dob)}</span>
                  <span className="hidden md:inline">•</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">location_on</span> Village: {child.village || '—'}</span>
                </div>
              </div>
              <button className="bg-primary text-on-primary text-label-md px-4 h-12 rounded-full flex items-center gap-1 shadow-sm hover:opacity-90 transition-opacity w-full md:w-auto justify-center">
                <span className="material-symbols-outlined">add_circle</span>
                Log Growth
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-4 flex flex-col gap-6">
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm relative overflow-hidden">
                  <h3 className="text-lg font-semibold text-on-surface mb-4">Nutrition Status</h3>
                  <div className="flex flex-col gap-3">
                    <div className="rounded-lg border border-outline-variant p-3 flex flex-col gap-1 text-on-surface-variant">
                      <span className="text-caption">Growth records not available</span>
                      <span className="text-body-md text-on-surface">—</span>
                    </div>
                    <p className="text-label-md text-on-surface-variant">No growth measurements have been recorded yet.</p>
                  </div>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-on-surface mb-4">Latest Snapshot</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-caption text-on-surface-variant">Weight</div>
                      <div className="text-2xl font-semibold text-on-surface">—</div>
                    </div>
                    <div>
                      <div className="text-caption text-on-surface-variant">Height</div>
                      <div className="text-2xl font-semibold text-on-surface">—</div>
                    </div>
                    <div>
                      <div className="text-caption text-on-surface-variant">MUAC</div>
                      <div className="text-2xl font-semibold text-on-surface">—</div>
                    </div>
                    <div>
                      <div className="text-caption text-on-surface-variant">Date</div>
                      <div className="text-body-md text-on-surface">—</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-8 flex flex-col gap-6">
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-on-surface">Growth Charts (WHO)</h3>
                    <select className="bg-surface border border-outline-variant rounded-md text-label-md text-on-surface h-12 px-3">
                      <option>Weight-for-Age</option>
                      <option>Height-for-Age</option>
                      <option>Weight-for-Height</option>
                    </select>
                  </div>
                  <div className="relative w-full h-64 md:h-80 bg-surface-container-low rounded-lg border border-outline-variant flex items-center justify-center text-body-md text-on-surface-variant">
                    No growth data to chart
                  </div>
                </div>

                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-on-surface">Measurement History</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low text-on-surface text-label-md border-b border-outline-variant">
                          <th className="p-3 md:p-4 whitespace-nowrap">Date</th>
                          <th className="p-3 md:p-4 whitespace-nowrap">Age</th>
                          <th className="p-3 md:p-4 whitespace-nowrap">Weight (kg)</th>
                          <th className="p-3 md:p-4 whitespace-nowrap">Height (cm)</th>
                          <th className="p-3 md:p-4 whitespace-nowrap">MUAC (cm)</th>
                        </tr>
                      </thead>
                      <tbody className="text-body-md text-on-surface">
                        <tr className="border-b border-outline-variant">
                          <td className="p-3 md:p-4 text-on-surface-variant">No records yet</td>
                          <td className="p-3 md:p-4">—</td>
                          <td className="p-3 md:p-4">—</td>
                          <td className="p-3 md:p-4">—</td>
                          <td className="p-3 md:p-4">—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
