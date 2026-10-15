import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { householdService } from '@/services/household.service'

export default function HouseholdSurvey() {
  const { id } = useParams<{ id: string }>()

  const { isLoading, isError, error, refetch } = useQuery({
    queryKey: ['household', id],
    queryFn: () => householdService.getHousehold(id!),
    enabled: Boolean(id),
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Household Health Survey"
        breadcrumbs={[{ label: 'Households', to: '/phc/households' }, { label: 'Survey' }]}
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : (
        <EmptyState
          icon="assignment"
          title="No survey recorded"
          description="Survey responses are not captured by the API yet. Household demographics and members are available on the household page."
          action={
            <Link
              to={`/phc/households/${id}`}
              className="rounded-full bg-primary px-4 py-2 text-label-md font-semibold text-on-primary"
            >
              Open household
            </Link>
          }
        />
      )}
    </div>
  )
}
