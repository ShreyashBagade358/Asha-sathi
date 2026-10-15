import { isAxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon, type IconName } from '@/components/common/Icons'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { relationshipLabel } from '@/lib/relationship'
import { patientService, type MyHouseholdMember } from '@/services/patient.service'

function memberIcon(member: MyHouseholdMember): IconName {
  return member.isPregnant ? 'heart' : 'users'
}

function relationOf(member: MyHouseholdMember, t: (key: string) => string): string {
  if (member.isSelf) return `${relationshipLabel(member.relationshipToHead, t)} · ${t('patient.you')}`
  return relationshipLabel(member.relationshipToHead, t)
}

/**
 * The signed-in patient's family, from `GET /patients/me/household`.
 *
 * A profile with no linked household renders as an empty state, not an error:
 * self-registered patients genuinely have no family row yet, and a red banner
 * would blame them for it.
 */
export default function PatientFamilyPage() {
  const { t } = useLocalization()

  const householdQuery = useQuery({
    queryKey: ['patient', 'household'],
    queryFn: () => patientService.getMyHousehold(),
    retry: false,
    staleTime: 60_000,
  })

  const household = householdQuery.data
  const notLinked =
    householdQuery.isError && isAxiosError(householdQuery.error) && householdQuery.error.response?.status === 404

  const body = (() => {
    if (householdQuery.isLoading) return <LoadingState />
    if (notLinked) {
      return <EmptyState icon="people" title={t('patient.noHousehold')} description={t('patient.noHouseholdHint')} />
    }
    if (householdQuery.isError) {
      return (
        <ErrorState message={getErrorMessage(householdQuery.error)} onRetry={() => householdQuery.refetch()} />
      )
    }
    if (!household) return null

    return (
      <>
        <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
          <span className="absolute bottom-0 left-0 top-0 w-2 bg-primary" />
          <div className="pl-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-caption text-caption text-on-surface-variant">{t('asha.householdIdLabel')}</p>
                <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
                  {household.householdId}
                </h2>
              </div>
              <span className="rounded-full bg-secondary-container px-3 py-1 font-caption text-caption font-semibold text-on-secondary-container">
                {t('patient.familySizeCount', { count: household.familySize ?? household.memberCount })}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 font-body-md text-body-md text-on-surface">
              <Icon name="users" size={18} className="text-outline" />
              <span>
                <strong>{t('patient.headOfHousehold')}:</strong> {household.headName || '—'}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 font-body-md text-body-md text-on-surface">
              <Icon name="mapPin" size={18} className="text-outline" />
              <span>
                {[household.address, household.village, household.ward].filter(Boolean).join(' · ') || '—'}
              </span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
              {t('patient.familyTitle')}
            </h3>
            <span className="rounded-full bg-surface-container-high px-3 py-1 font-caption text-caption text-on-surface">
              {household.memberCount} {t('asha.members')}
            </span>
          </div>

          {household.members.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
              {t('asha.noMembersRecorded')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {household.members.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border bg-surface-container-lowest p-4 shadow-card ${
                    member.isSelf ? 'border-primary' : 'border-outline-variant'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-touch-target w-touch-target shrink-0 items-center justify-center rounded-full ${
                        member.isPregnant
                          ? 'bg-tertiary-container text-on-tertiary-container'
                          : 'bg-surface-container-high text-primary'
                      }`}
                    >
                      <Icon name={memberIcon(member)} size={20} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-body-md text-body-md font-bold text-on-surface">
                        {member.fullName}
                      </p>
                      <p className="truncate font-caption text-caption text-on-surface-variant">
                        {member.gender ?? '—'},{' '}
                        {typeof member.ageYears === 'number'
                          ? `${member.ageYears} ${t('patient.years')}`
                          : typeof member.ageMonths === 'number'
                            ? `${member.ageMonths} ${t('patient.months')}`
                            : '—'}
                        {' · '}
                        {relationOf(member, t)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {member.isSelf ? (
                      <span className="rounded-full bg-primary px-2.5 py-0.5 font-caption text-caption font-semibold text-on-primary">
                        {t('patient.you')}
                      </span>
                    ) : null}
                    {member.isPregnant ? (
                      <span className="rounded-full bg-tertiary-container px-2.5 py-0.5 font-caption text-caption text-on-tertiary-container">
                        {t('asha.highRisk')}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </>
    )
  })()

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={t('patient.familyTitle')} subtitle={t('patient.familySubtitle')} />
      {body}
    </div>
  )
}
