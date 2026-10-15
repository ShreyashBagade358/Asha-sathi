import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ASHACard } from 'asha-design-system'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { pregnancyService } from '@/services/pregnancy.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import type { Pregnancy } from '@/types'

const PAGE_SIZE = 20

type RiskFilter = 'all' | 'high' | 'medium' | 'low'

const RISK_STYLE: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-error-container text-on-error-container',
  medium: 'bg-tertiary-container text-on-tertiary-container',
  low: 'bg-secondary-container text-on-secondary-container',
}

function riskOf(p: Pregnancy): 'high' | 'medium' | 'low' {
  if (p.hrpLevel) return p.hrpLevel
  if (p.complications.length > 0) return 'medium'
  return 'low'
}

export default function RiskAnalysis() {
  const [filter, setFilter] = useState<RiskFilter>('all')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pregnancies', 'risk', page],
    queryFn: () => pregnancyService.listPregnancies({ page, pageSize: PAGE_SIZE }),
  })

  const beneficiariesQuery = useQuery({
    queryKey: ['beneficiaries', 'risk-map'],
    queryFn: () => beneficiaryService.listBeneficiaries({ page: 1, pageSize: 200 }),
  })

  const benMap = useMemo(() => {
    const m = new Map<string, { name: string; village: string }>()
    for (const b of beneficiariesQuery.data?.items ?? []) {
      m.set(b.id, { name: b.name, village: b.village })
    }
    return m
  }, [beneficiariesQuery.data])

  const all = useMemo(() => data?.items ?? [], [data])
  const pregnancies = filter === 'all' ? all : all.filter((p) => riskOf(p) === filter)

  const counts = {
    high: all.filter((p) => riskOf(p) === 'high').length,
    medium: all.filter((p) => riskOf(p) === 'medium').length,
    low: all.filter((p) => riskOf(p) === 'low').length,
  }
  const total = all.length

  const riskFactorSummary = useMemo(() => {
    const counter = new Map<string, number>()
    for (const p of all) {
      for (const f of p.complications) {
        const base = f.split(' (')[0]
        counter.set(base, (counter.get(base) ?? 0) + 1)
      }
    }
    return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [all])

  const riskCards: { key: 'high' | 'medium' | 'low'; label: string; desc: string; chip: string }[] = [
    { key: 'high', label: 'High Risk', desc: 'Needs immediate attention & referral', chip: RISK_STYLE.high },
    { key: 'medium', label: 'Medium Risk', desc: 'Monitor closely, extra ANC visits', chip: RISK_STYLE.medium },
    { key: 'low', label: 'Low Risk', desc: 'Routine follow-up is enough', chip: RISK_STYLE.low },
  ]

  const totalPages = data?.totalPages ?? 1

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Risk Analysis" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {riskCards.map((card) => {
          const pct = total > 0 ? Math.round((counts[card.key] / total) * 100) : 0
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setFilter(filter === card.key ? 'all' : card.key)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                filter === card.key
                  ? 'border-primary bg-primary-container/40'
                  : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-1 text-caption font-semibold capitalize ${card.chip}`}>
                  {card.key}
                </span>
                <span className="text-headline-lg font-semibold text-on-surface">{counts[card.key]}</span>
              </div>
              <p className="mt-2 text-label-md font-semibold text-on-surface">{card.label}</p>
              <p className="text-label-sm text-on-surface-variant">{card.desc}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
                <div
                  className={`h-full rounded-full ${
                    card.key === 'high' ? 'bg-error' : card.key === 'medium' ? 'bg-tertiary' : 'bg-secondary'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-caption text-on-surface-variant">{pct}% of visible pregnancies</p>
            </button>
          )
        })}
      </div>

      {riskFactorSummary.length > 0 && (
        <ASHACard title="Top Risk Factors">
          <div className="flex flex-wrap gap-2">
            {riskFactorSummary.map(([factor, count]) => (
              <span
                key={factor}
                className="rounded-full bg-error-container/60 px-3 py-1.5 text-label-sm font-medium text-on-error-container"
              >
                {factor} · {count}
              </span>
            ))}
          </div>
        </ASHACard>
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : pregnancies.length === 0 ? (
        <EmptyState
          icon="monitorHeart"
          title="No pregnancies to analyse"
          description="Risk levels appear here once pregnancies are registered."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">Beneficiary</th>
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">Village</th>
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">Gravida / Para</th>
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">Risk Factors</th>
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">ANC Visits</th>
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {pregnancies.map((p) => {
                const risk = riskOf(p)
                const ben = benMap.get(p.beneficiaryId)
                return (
                  <tr key={p.id} className="border-b border-outline-variant/50 last:border-0">
                    <td className="px-5 py-3">
                      <p className="text-body-md font-medium text-on-surface">{ben?.name ?? 'Unknown'}</p>
                      <p className="text-caption text-on-surface-variant">{p.beneficiaryId.slice(0, 8)}</p>
                    </td>
                    <td className="px-5 py-3 text-body-md text-on-surface-variant">{ben?.village ?? '—'}</td>
                    <td className="px-5 py-3 text-center text-body-md text-on-surface">
                      {p.gravida} / {p.para}
                    </td>
                    <td className="px-5 py-3 text-body-md text-on-surface-variant">
                      {p.complications.length > 0 ? p.complications.join(', ') : 'None'}
                    </td>
                    <td className="px-5 py-3 text-body-md text-on-surface">{p.ancCount ?? 0}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-caption font-semibold capitalize ${RISK_STYLE[risk]}`}>
                        {risk}
                      </span>
                    </td>
                  </tr>
               )
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-label-sm text-on-surface-variant">
            Page {page} of {totalPages} · {data?.total ?? 0} pregnancies
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-outline px-4 py-2 text-label-md font-semibold text-on-surface disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-outline px-4 py-2 text-label-md font-semibold text-on-surface disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
