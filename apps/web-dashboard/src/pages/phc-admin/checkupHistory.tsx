import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { ncdService, type NCDScreening } from '@/services/ncd.service'
import { beneficiaryService } from '@/services/beneficiary.service'

const RISK_CHIP: Record<string, { className: string; dot: string; label: string }> = {
  high: { className: 'bg-error-container text-on-error-container', dot: 'bg-error', label: 'High' },
  medium: { className: 'bg-tertiary-fixed text-on-tertiary-fixed', dot: 'bg-tertiary', label: 'Moderate' },
  moderate: { className: 'bg-tertiary-fixed text-on-tertiary-fixed', dot: 'bg-tertiary', label: 'Moderate' },
  low: { className: 'bg-secondary-container text-on-secondary-container', dot: 'bg-secondary', label: 'Low' },
}

function overallRisk(s: NCDScreening): string {
  const levels = [s.diabetesRisk, s.hypertensionRisk, s.cardiovascularRisk, s.cancerRisk]
  if (levels.includes('high')) return 'high'
  if (levels.includes('medium') || levels.includes('moderate')) return 'medium'
  return 'low'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function HealthCheckUpHistoryPhcAdmin() {
  const [search, setSearch] = useState('')

  const screeningsQuery = useQuery({
    queryKey: ['ncd-screenings', 'history'],
    queryFn: () => ncdService.listScreenings({ pageSize: 200 }),
  })

  const benQuery = useQuery({
    queryKey: ['beneficiaries-map'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })

  const benMap = useMemo(() => {
    const m = new Map<string, { name: string; village: string; gender: string }>()
    for (const b of benQuery.data?.items ?? []) {
      m.set(b.id, { name: b.name, village: b.village ?? '—', gender: b.gender ?? '' })
    }
    return m
  }, [benQuery.data])

  const rows = useMemo(() => {
    const items = (screeningsQuery.data?.items ?? []).map((s) => {
      const ben = benMap.get(s.beneficiaryId)
      return { screening: s, name: ben?.name ?? 'Unknown', village: ben?.village ?? '—' }
    })
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((r) => r.name.toLowerCase().includes(q) || r.village.toLowerCase().includes(q))
  }, [screeningsQuery.data, benMap, search])

  if (screeningsQuery.isLoading || benQuery.isLoading) {
    return (
        <div className="flex items-center justify-center py-24">
          <LoadingState label="Loading check-up history…" />
        </div>
    )
  }

  if (screeningsQuery.isError) {
    return (
        <div className="flex items-center justify-center py-24">
          <ErrorState message={getErrorMessage(screeningsQuery.error)} onRetry={() => screeningsQuery.refetch()} />
        </div>
    )
  }

  const total = screeningsQuery.data?.total ?? 0
  const highCount = rows.filter((r) => overallRisk(r.screening) === 'high').length

  return (
      <div className="mx-auto w-full max-w-[1440px] flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-headline-lg text-on-background font-semibold">Health Check-up History</h2>
            <p className="text-body-md text-on-surface-variant mt-1">
              {total} screening{total === 1 ? '' : 's'} recorded · {highCount} high risk
            </p>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient or village…"
            className="h-12 w-full sm:w-72 rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No check-ups recorded yet"
            description="NCD screenings created from ASHA check-up forms will appear here."
            icon="health_and_safety"
          />
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-bright">
                    <th className="p-3 px-4 text-label-md text-on-surface-variant whitespace-nowrap">Date</th>
                    <th className="p-3 px-4 text-label-md text-on-surface-variant">Patient</th>
                    <th className="p-3 px-4 text-label-md text-on-surface-variant">BP</th>
                    <th className="p-3 px-4 text-label-md text-on-surface-variant">CBAC</th>
                    <th className="p-3 px-4 text-label-md text-on-surface-variant">Risk</th>
                    <th className="p-3 px-4 text-label-md text-on-surface-variant text-right">Referral</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {rows.map(({ screening: s, name, village }) => {
                    const risk = overallRisk(s)
                    const chip = RISK_CHIP[risk] ?? RISK_CHIP.low
                    const bpTone =
                      (s.bpSystolic ?? 0) >= 150 ? 'text-error' : (s.bpSystolic ?? 0) >= 130 ? 'text-tertiary' : 'text-secondary'
                    return (
                      <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-3 px-4 text-body-md text-on-surface whitespace-nowrap">
                          {formatDate(s.screeningDate)}
                        </td>
                        <td className="p-3 px-4">
                          <div className="text-body-md text-on-surface font-medium">{name}</div>
                          <div className="text-caption text-on-surface-variant">{village}</div>
                        </td>
                        <td className="p-3 px-4 text-body-md">
                          {s.bpSystolic != null && s.bpDiastolic != null ? (
                            <span className={`font-semibold ${bpTone}`}>
                              {s.bpSystolic}/{s.bpDiastolic}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant">—</span>
                          )}
                        </td>
                        <td className="p-3 px-4 text-body-md text-on-surface">
                          {s.cbacScore ?? <span className="text-on-surface-variant">—</span>}
                        </td>
                        <td className="p-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-caption rounded-full ${chip.className}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${chip.dot}`} /> {chip.label}
                          </span>
                        </td>
                        <td className="p-3 px-4 text-right text-body-md text-on-surface">
                          {s.referralMade ? (
                            <span className="text-secondary font-semibold">Referred</span>
                          ) : (
                            <span className="text-on-surface-variant">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
  )
}
