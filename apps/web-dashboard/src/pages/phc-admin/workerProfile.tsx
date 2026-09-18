import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { ashaService } from '@/services/asha.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function statusColor(status: string) {
  if (status === 'active') return { bg: 'bg-secondary-container', text: 'text-on-secondary-container', dot: 'bg-secondary', label: 'Active' }
  if (status === 'inactive') return { bg: 'bg-surface-container-highest', text: 'text-on-surface-variant', dot: 'bg-outline', label: 'Inactive' }
  return { bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', dot: 'bg-tertiary', label: 'On Leave' }
}

export default function AshaWorkerProfileSunitaDevi() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['asha-detail', id],
    queryFn: () => ashaService.getASHADetail(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
          <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center px-6 shrink-0 z-10">
            <div className="flex items-center gap-4">
              <button className="lg:hidden p-2 text-on-surface-variant"><span className="material-symbols-outlined">menu</span></button>
              <h2 className="text-headline-md text-on-surface">Worker Profile</h2>
            </div>
          </header>
          <div className="flex-1 flex items-center justify-center">
            <LoadingState label="Loading worker profile…" />
          </div>
        </main>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
          <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center px-6 shrink-0 z-10">
            <div className="flex items-center gap-4">
              <button className="lg:hidden p-2 text-on-surface-variant"><span className="material-symbols-outlined">menu</span></button>
              <h2 className="text-headline-md text-on-surface">Worker Profile</h2>
            </div>
          </header>
          <div className="flex-1 flex items-center justify-center px-6">
            <ErrorState message={getErrorMessage(error)} />
          </div>
        </main>
      </div>
    )
  }

  const { asha: worker, kpis, villages, assignedBeneficiaries } = data
  const s = statusColor(worker.status)

  const latestKpi = kpis.length > 0 ? kpis[0] : null

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 text-on-surface-variant"><span className="material-symbols-outlined">menu</span></button>
            <div>
              <h2 className="text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
                {worker.name}
              </h2>
              <p className="text-caption text-on-surface-variant">
                <button onClick={() => {}} className="text-primary hover:underline cursor-pointer">Workers</button>
                <span className="mx-1 text-outline">/</span>
                <span>{worker.name}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold ${s.bg} ${s.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
              {s.label}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col items-center text-center">
              <div className="relative mb-4">
                <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-headline-lg font-headline-lg">
                  {initials(worker.name)}
                </span>
                <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-surface bg-secondary" />
              </div>
              <h1 className="text-headline-lg text-on-surface mb-1">{worker.name}</h1>
              <p className="text-body-md text-on-surface-variant mb-2">ID: {worker.ashaId}</p>
              <span className={`mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold ${s.bg} ${s.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                {s.label}
              </span>
              <div className="flex w-full gap-2 mt-auto">
                <button className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary-container px-4 py-2 text-label-md font-semibold text-on-primary-container transition-colors hover:bg-primary hover:text-on-primary">
                  <span className="material-symbols-outlined text-[18px]">call</span>
                  Call
                </button>
                <button className="flex flex-1 items-center justify-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container">
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  Message
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                    <span className="material-symbols-outlined text-[20px]">home</span>
                  </div>
                  <span className="text-label-md text-secondary">Assigned</span>
                </div>
                <div>
                  <div className="text-display-lg text-on-surface font-display-lg">{worker.assignedHouseholds}</div>
                  <div className="text-caption text-on-surface-variant">Households</div>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  </div>
                  <span className="text-label-md text-on-surface-variant">This Period</span>
                </div>
                <div>
                  <div className="text-display-lg text-on-surface font-display-lg">
                    {latestKpi?.homeVisits ?? 0}<span className="text-headline-md text-on-surface-variant"> home visits</span>
                  </div>
                  <div className="text-caption text-on-surface-variant">Visit Activity</div>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
                    <span className="material-symbols-outlined text-[20px]">star</span>
                  </div>
                </div>
                <div>
                  <div className="text-display-lg text-on-surface font-display-lg">{worker.performanceScore}%</div>
                  <div className="text-caption text-on-surface-variant">Performance Score</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
              <h3 className="text-headline-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">info</span>
                Personal Information
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Phone Number', value: `+91 ${worker.phone}`, icon: 'phone' },
                  { label: 'Village', value: worker.village || '—', icon: 'location_on' },
                  { label: 'Assigned Households', value: String(worker.assignedHouseholds), icon: 'home' },
                  { label: 'Assigned Beneficiaries', value: String(assignedBeneficiaries), icon: 'groups' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-low transition-colors">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{item.icon}</span>
                    <div>
                      <p className="text-caption text-on-surface-variant">{item.label}</p>
                      <p className="text-body-md text-on-surface font-medium">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
              <h3 className="text-headline-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">group</span>
                Assigned Villages
                <span className="text-caption text-on-surface-variant ml-auto">{villages.length} total</span>
              </h3>
              {villages.length === 0 ? (
                <p className="text-body-md text-on-surface-variant text-center py-8">No villages assigned.</p>
              ) : (
                <div className="space-y-2">
                  {villages.map((v) => (
                    <div
                      key={v}
                      className="flex items-center justify-between rounded-lg border border-outline-variant/50 px-4 py-3 transition-colors hover:bg-surface-container-low"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                          <span className="material-symbols-outlined text-[18px]">location_on</span>
                        </span>
                        <p className="text-label-md font-semibold text-on-surface">{v}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {kpis.length > 0 && (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
                <h3 className="text-headline-md font-semibold text-on-surface">KPIs</h3>
                <span className="text-caption text-on-surface-variant ml-auto">{kpis.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/50 bg-surface-container-low/50">
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Period</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant text-center">Pregnancies</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant text-center">ANC 4+</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant text-center">Deliveries</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant text-center">Immunization</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant text-center">HRP</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant text-center">NCD</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant text-center">Home Visits</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant text-center">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.map((k, i) => (
                      <tr key={`${k.period}-${i}`} className={`transition-colors hover:bg-surface-container-low/40 ${i < kpis.length - 1 ? 'border-b border-outline-variant/40' : ''} ${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}`}>
                        <td className="px-5 py-3 text-body-md text-on-surface font-medium whitespace-nowrap">{k.period}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface text-center">{k.pregnantWomenRegistered}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface text-center">{k.anc4PlusCompleted}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface text-center">{k.institutionalDeliveries}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface text-center">{k.immunizationCoverage}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface text-center">{k.hrpIdentified}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface text-center">{k.ncdScreened}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface text-center">{k.homeVisits}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-label-md font-bold ${
                            k.performanceScore >= 80 ? 'bg-secondary-container text-on-secondary-container'
                              : k.performanceScore >= 60 ? 'bg-tertiary-container text-on-tertiary-container'
                                : 'bg-error-container text-on-error-container'
                          }`}>
                            {k.performanceScore}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
