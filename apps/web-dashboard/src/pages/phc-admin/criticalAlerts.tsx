import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { pregnancyService } from '@/services/pregnancy.service'
import type { Pregnancy } from '@/types'

const PAGE_SIZE = 50

type Severity = 'critical' | 'high' | 'medium'

function severityOf(p: Pregnancy): Severity {
  if (p.hrpLevel === 'high') return 'critical'
  if (p.hrpLevel === 'medium' || p.highRisk) return 'high'
  return 'medium'
}

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: 'bg-error text-on-error',
  high: 'bg-error-container text-on-error-container',
  medium: 'bg-tertiary-container text-on-tertiary-container',
}

export default function CriticalAlerts() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pregnancies', 'alerts', 1],
    queryFn: () => pregnancyService.listPregnancies({ page: 1, pageSize: PAGE_SIZE }),
  })

  const alerts = (data?.items ?? []).filter((p) => p.hrpLevel || p.highRisk)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Critical Alerts" subtitle="Pregnancies currently flagged as high risk." />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon="checkCircle"
          title="No critical alerts"
          description="No high-risk pregnancies are currently flagged. Alerts appear here as soon as the backend raises one."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((p) => {
            const severity = severityOf(p)
            return (
              <div
                key={p.id}
                className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${SEVERITY_STYLE[severity]}`}>
                      {severity}
                    </span>
                    <span className="truncate text-body-md font-semibold text-on-surface">
                      {p.id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="mt-1 text-body-md text-on-surface-variant">
                    {p.complications.length > 0 ? p.complications.join(', ') : 'Flagged high risk'}
                  </p>
                  <p className="mt-0.5 text-caption text-on-surface-variant">EDD {p.edd}</p>
                </div>
                <Link
                  to={`/asha/patients/${p.beneficiaryId}`}
                  className="shrink-0 rounded-full bg-primary px-4 py-2 text-center text-label-md font-semibold text-on-primary transition-colors hover:bg-on-primary-fixed-variant"
                >
                  View patient
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
