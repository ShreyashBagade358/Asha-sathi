import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { pregnancyService } from '@/services/pregnancy.service'
import type { Pregnancy } from '@/types'

const PAGE_SIZE = 50

type RiskFilter = 'all' | 'high' | 'medium' | 'low'

const RISK_STYLE: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-error-container text-on-error-container',
  medium: 'bg-tertiary-container text-on-tertiary-container',
  low: 'bg-secondary-container text-on-secondary-container',
}

function riskOf(p: Pregnancy): 'high' | 'medium' | 'low' {
  if (p.hrpLevel) return p.hrpLevel
  return p.highRisk ? 'high' : 'low'
}

export default function RiskAnalysis() {
  const [filter, setFilter] = useState<RiskFilter>('all')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pregnancies', 'risk', 1],
    queryFn: () => pregnancyService.listPregnancies({ page: 1, pageSize: PAGE_SIZE }),
  })

  const all = data?.items ?? []
  const pregnancies = filter === 'all' ? all : all.filter((p) => riskOf(p) === filter)

  const counts = {
    all: all.length,
    high: all.filter((p) => riskOf(p) === 'high').length,
    medium: all.filter((p) => riskOf(p) === 'medium').length,
    low: all.filter((p) => riskOf(p) === 'low').length,
  }

  const tabs: { key: RiskFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'high', label: 'High', count: counts.high },
    { key: 'medium', label: 'Medium', count: counts.medium },
    { key: 'low', label: 'Low', count: counts.low },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Risk Analysis" subtitle="Pregnancies flagged as high risk pregnancy by the backend." />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-label-md font-semibold transition-colors ${
              filter === tab.key
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 text-[11px] font-bold leading-4 ${
                filter === tab.key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-variant text-on-surface-variant'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

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
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">Pregnancy</th>
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">EDD</th>
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">Gravida / Para</th>
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">Complications</th>
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">Risk</th>
              </tr>
            </thead>
            <tbody>
              {pregnancies.map((p) => {
                const risk = riskOf(p)
                return (
                  <tr key={p.id} className="border-b border-outline-variant/50 last:border-0">
                    <td className="px-5 py-3 text-body-md font-medium text-on-surface">{p.id.slice(0, 8)}</td>
                    <td className="px-5 py-3 text-body-md text-on-surface-variant">{p.edd}</td>
                    <td className="px-5 py-3 text-center text-body-md text-on-surface">
                      {p.gravida} / {p.para}
                    </td>
                    <td className="px-5 py-3 text-body-md text-on-surface-variant">
                      {p.complications.length > 0 ? p.complications.join(', ') : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-caption font-semibold ${RISK_STYLE[risk]}`}>
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
    </div>
  )
}
