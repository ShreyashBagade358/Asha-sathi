import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { ashaService, type ASHAUser } from '@/services/asha.service'

const PAGE_SIZE = 50

type Row = {
  user: ASHAUser
  pregnancies: number
  anc4: number
  deliveries: number
  immunization: number
  hrp: number
  visits: number
  score: number
}

function buildRow(user: ASHAUser): Row {
  // listASHAs returns the summary row; KPI detail lives on getASHADetail.
  // Use the summary fields the server already computed.
  return {
    user,
    pregnancies: 0,
    anc4: 0,
    deliveries: 0,
    immunization: 0,
    hrp: 0,
    visits: user.assignedHouseholds,
    score: user.performanceScore ?? 0,
  }
}

export default function AshaPerformance() {
  const [search, setSearch] = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ashas', 'performance', search],
    queryFn: () => ashaService.listASHAs({ search: search || undefined, page: 1, pageSize: PAGE_SIZE }),
  })

  const workers = (data?.items ?? []).map(buildRow)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="ASHA Performance & Activity" />

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ASHA workers"
          className="h-10 w-full max-w-xs rounded-lg border border-outline-variant bg-surface px-3 text-body-md text-on-surface focus:border-primary focus:outline-none"
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : workers.length === 0 ? (
        <EmptyState icon="groups" title="No ASHA workers found" description="Register ASHA workers to start tracking their performance." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">ASHA</th>
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">Village</th>
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">Households</th>
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">Status</th>
                <th className="px-5 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">Score</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((row) => (
                <tr key={row.user.id} className="border-b border-outline-variant/50 last:border-0">
                  <td className="px-5 py-3 text-body-md font-medium text-on-surface">{row.user.name}</td>
                  <td className="px-5 py-3 text-body-md text-on-surface-variant">{row.user.village || '—'}</td>
                  <td className="px-5 py-3 text-center text-body-md text-on-surface">{row.user.assignedHouseholds}</td>
                  <td className="px-5 py-3 text-body-md text-on-surface-variant">{row.user.status}</td>
                  <td className="px-5 py-3 text-center text-body-md font-semibold text-on-surface">
                    {row.score ? `${Math.round(row.score)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
