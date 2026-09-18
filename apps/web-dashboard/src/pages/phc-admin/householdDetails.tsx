import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { householdService } from '@/services/household.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function HouseholdDetailsPhcAdmin() {
  const { id } = useParams<{ id: string }>()

  const { data: household, isLoading: hhLoading, isError: hhError, error: hhErrorObj } = useQuery({
    queryKey: ['household-detail', id],
    queryFn: () => householdService.getHousehold(id!),
    enabled: !!id,
  })

  const { data: membersData, isLoading: membersLoading, isError: membersError, error: membersErrorObj } = useQuery({
    queryKey: ['household-members', id],
    queryFn: () => householdService.listHouseholdMembers(id!, { pageSize: 50 }),
    enabled: !!id,
  })

  const isLoading = hhLoading || membersLoading
  const isError = hhError || membersError
  const error = hhErrorObj || membersErrorObj

  const members = membersData?.items ?? []
  const memberCount = membersData?.total ?? members.length

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 overflow-y-auto pb-24 md:pb-0 flex flex-col">
          <header className="bg-surface-container-lowest border-b border-outline-variant px-6 h-16 flex items-center shrink-0">
            <Link to="/phc/households" className="flex items-center gap-2 text-primary hover:bg-surface-container-low px-3 py-1.5 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              <span className="font-label-md text-label-md hidden sm:inline">Back to Households</span>
            </Link>
          </header>
          <div className="flex-1 flex items-center justify-center">
            <LoadingState label="Loading household…" />
          </div>
        </main>
      </div>
    )
  }

  if (isError || !household) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 overflow-y-auto pb-24 md:pb-0 flex flex-col">
          <header className="bg-surface-container-lowest border-b border-outline-variant px-6 h-16 flex items-center shrink-0">
            <Link to="/phc/households" className="flex items-center gap-2 text-primary hover:bg-surface-container-low px-3 py-1.5 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              <span className="font-label-md text-label-md hidden sm:inline">Back to Households</span>
            </Link>
          </header>
          <div className="flex-1 flex items-center justify-center px-6">
            <ErrorState message={getErrorMessage(error)} />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 overflow-y-auto pb-24 md:pb-0 flex flex-col">
        <header className="bg-surface-container-lowest border-b border-outline-variant px-6 h-16 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link to="/phc/households" className="flex items-center gap-2 text-primary hover:bg-surface-container-low px-3 py-1.5 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              <span className="font-label-md text-label-md hidden sm:inline">Back to Households</span>
            </Link>
            <div className="h-6 w-px bg-outline-variant mx-1"></div>
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface flex items-center gap-2">
                Household Details
                <span className="bg-surface-container text-on-surface-variant font-label-md text-label-md px-3 py-[2px] rounded-full border border-outline-variant">HHID: {household.householdId}</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 border border-outline hover:bg-surface-container-low text-primary font-label-md text-label-md px-4 h-10 rounded-xl transition-colors">
              <span className="material-symbols-outlined text-[20px]">edit</span>
              <span className="hidden md:inline">Edit Details</span>
            </button>
            <button className="flex items-center gap-2 bg-primary text-on-primary hover:opacity-90 font-label-md text-label-md px-4 h-10 rounded-xl transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[20px]">add_box</span>
              <span>Log Visit</span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 space-y-6 max-w-[1440px] w-full mx-auto">
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px] text-tertiary">home</span>
                <h2 className="font-label-md text-label-md uppercase tracking-wider">Location</h2>
              </div>
              <div className="font-body-lg text-body-lg text-on-surface mt-auto">
                {household.village || '—'}
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px] text-primary">group</span>
                <h2 className="font-label-md text-label-md uppercase tracking-wider">Total Members</h2>
              </div>
              <div className="flex items-baseline gap-2 mt-auto">
                <span className="font-display-lg text-display-lg text-on-surface">{memberCount}</span>
                <span className="font-caption text-caption text-on-surface-variant">Registered</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px] text-secondary">pregnant_woman</span>
                <h2 className="font-label-md text-label-md uppercase tracking-wider">Pregnant Women</h2>
              </div>
              <div className="font-body-lg text-body-lg text-on-surface mt-auto">
                {household.pregnantWomen}
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px] text-primary">child_care</span>
                <h2 className="font-label-md text-label-md uppercase tracking-wider">Children {"<"} 5</h2>
              </div>
              <div className="font-body-lg text-body-lg text-on-surface mt-auto">
                {household.childrenUnder5}
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden min-h-[200px]">
            {membersLoading ? (
              <LoadingState label="Loading members…" />
            ) : membersError ? (
              <ErrorState message={getErrorMessage(membersErrorObj)} />
            ) : members.length === 0 ? (
              <EmptyState
                title="No members found"
                description="This household has no registered members yet."
                icon="group_off"
              />
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low border-b border-outline-variant">
                    <tr>
                      <th className="py-3 px-4 font-label-md text-label-md text-on-surface-variant font-medium">Name</th>
                      <th className="py-3 px-4 font-label-md text-label-md text-on-surface-variant font-medium">Age</th>
                      <th className="py-3 px-4 font-label-md text-label-md text-on-surface-variant font-medium">Gender</th>
                      <th className="py-3 px-4 font-label-md text-label-md text-on-surface-variant font-medium">Marital Status</th>
                      <th className="py-3 px-4 font-label-md text-label-md text-on-surface-variant font-medium">Pregnant</th>
                      <th className="py-3 px-4 font-label-md text-label-md text-on-surface-variant font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {members.map((m) => (
                      <tr key={m.id} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-caption font-semibold">
                              {initials(m.fullName)}
                            </span>
                            <div>
                              <div className="font-body-md text-body-md text-on-surface font-medium">{m.fullName}</div>
                              {m.beneficiaryId && (
                                <div className="font-caption text-caption text-on-surface-variant">ID: {m.beneficiaryId}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-body-md text-body-md">
                          {m.ageYears != null ? `${m.ageYears}y` : m.ageMonths != null ? `${m.ageMonths}m` : '—'}
                        </td>
                        <td className="py-3 px-4 font-body-md text-body-md capitalize">{m.gender || '—'}</td>
                        <td className="py-3 px-4 font-body-md text-body-md capitalize">{m.maritalStatus || '—'}</td>
                        <td className="py-3 px-4">
                          {m.isPregnant ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-[2px] rounded-full bg-tertiary-container text-on-tertiary-container font-caption text-caption font-semibold">
                              <span className="material-symbols-outlined text-[14px]">pregnant_woman</span>
                              Yes
                            </span>
                          ) : (
                            <span className="text-caption text-on-surface-variant">No</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {m.beneficiaryId ? (
                            <Link to={`/phc/beneficiaries/${m.beneficiaryId}`} className="text-primary hover:text-primary-container p-1 rounded hover:bg-surface-container-low transition-colors">
                              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                            </Link>
                          ) : (
                            <span className="text-on-surface-variant/30 p-1 inline-flex">
                              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
