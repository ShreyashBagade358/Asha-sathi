import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardService, type PHCDashboard } from '@/services/dashboard.service'

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.max(1, Math.round(diff / 60000))
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`
  const hrs = Math.round(mins / 60)
  return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
}

export default function PhcAdminDashboard() {
  const [data, setData] = useState<PHCDashboard | null>(null)

  useEffect(() => {
    let active = true
    dashboardService.getPHCDashboard('phc-demo').then((d) => {
      if (active) setData(d)
    })
    return () => {
      active = false
    }
  }, [])

  const k = data?.kpis
  const alerts = (data?.hrpAlerts ?? []).slice(0, 3)
  const syncs = (data?.recentSyncs ?? []).slice(0, 5)
  const trend = data?.coverageTrend ?? []
  const maxTrend = Math.max(1, ...trend.map((p) => Math.max(p.anc4, p.institutional, p.immunization, p.ncd)))
  const immunization = k?.immunizationCoverage ?? 85
  const vaccinationDone = Math.round((immunization / 100) * (k?.beneficiaryCount ?? 1250))
  const vaccinationPending = (k?.beneficiaryCount ?? 1250) - vaccinationDone

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <aside className="w-64 flex-shrink-0 bg-surface-container-lowest border-r border-outline-variant hidden lg:flex flex-col">
          <div className="p-6 border-b border-outline-variant flex items-center gap-3">
            <div className="size-8 bg-primary rounded flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined">health_and_safety</span>
            </div>
            <div>
              <h1 className="text-headline-md leading-tight text-primary font-bold">ASHA Sathi</h1>
              <p className="text-caption text-outline">Admin Portal</p>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            <Link className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-container text-on-primary-container font-semibold transition-all" to="/phc/dashboard">
              <span className="material-symbols-outlined">dashboard</span>
              <span>Dashboard</span>
            </Link>
            <Link className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container transition-all" to="/phc/ashas">
              <span className="material-symbols-outlined">group</span>
              <span>Workers</span>
            </Link>
            <Link className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container transition-all" to="/phc/beneficiaries">
              <span className="material-symbols-outlined">volunteer_activism</span>
              <span>Beneficiaries</span>
            </Link>
            <Link className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container transition-all" to="/phc/households">
              <span className="material-symbols-outlined">house</span>
              <span>Households</span>
            </Link>
            <Link className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container transition-all" to="/phc/maternal">
              <span className="material-symbols-outlined">pregnant_woman</span>
              <span>Maternal Health</span>
            </Link>
            <Link className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container transition-all" to="/phc/children">
              <span className="material-symbols-outlined">child_care</span>
              <span>Child Health</span>
            </Link>
            <Link className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container transition-all" to="/phc/vaccination">
              <span className="material-symbols-outlined">inventory_2</span>
              <span>Vaccination</span>
            </Link>
            <Link className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container transition-all" to="/phc/alerts">
              <span className="material-symbols-outlined">notification_important</span>
              <span>Alerts</span>
            </Link>
            <Link className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container transition-all" to="/phc/analytics">
              <span className="material-symbols-outlined">analytics</span>
              <span>Analytics</span>
            </Link>
          </nav>
        </aside>
        <main className="flex-1 flex flex-col overflow-hidden bg-surface-bright">
          <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 z-10">
            <div className="flex items-center gap-4">
              <button className="lg:hidden p-2 text-on-surface-variant">
                <span className="material-symbols-outlined">menu</span>
              </button>
              <div>
                <h2 className="text-headline-md text-on-surface">PHC Administrator - Rampur PHC</h2>
                <p className="text-caption text-secondary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: '\'FILL\' 1' }}>fiber_manual_record</span>
                  Live Dashboard Monitoring
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant">
                <span className="material-symbols-outlined text-secondary mr-2" style={{ fontVariationSettings: '\'FILL\' 1' }}>sync</span>
                <span className="text-label-md text-on-surface">System Sync: <span className="text-secondary font-bold">Online</span></span>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full relative">
                  <span className="material-symbols-outlined">notifications</span>
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>
                </button>
                <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full">
                  <span className="material-symbols-outlined">search</span>
                </button>
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant flex items-center gap-4">
                <div className="p-3 bg-primary-container text-on-primary-container rounded-lg">
                  <span className="material-symbols-outlined text-[28px]">groups</span>
                </div>
                <div>
                  <p className="text-caption text-outline-variant font-medium">Total ASHA Workers</p>
                  <h3 className="text-display-lg text-on-surface">{k?.ashaCount ?? 24}</h3>
                  <p className="text-caption text-secondary font-bold">{k?.villageCount ?? 5} villages</p>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant flex items-center gap-4">
                <div className="p-3 bg-tertiary-container text-on-tertiary-container rounded-lg">
                  <span className="material-symbols-outlined text-[28px]">patient_list</span>
                </div>
                <div>
                  <p className="text-caption text-outline-variant font-medium">Registered Patients</p>
                  <h3 className="text-display-lg text-on-surface">{(k?.beneficiaryCount ?? 1250).toLocaleString()}</h3>
                  <p className="text-caption text-secondary font-bold">Period: {k?.period ?? '-'}</p>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant flex items-center gap-4">
                <div className="p-3 bg-secondary-container text-on-secondary-container rounded-lg">
                  <span className="material-symbols-outlined text-[28px]">event_available</span>
                </div>
                <div>
                  <p className="text-caption text-outline-variant font-medium">Home Visits</p>
                  <h3 className="text-display-lg text-on-surface">{(k?.homeVisits ?? 42).toLocaleString()}</h3>
                  <p className="text-caption text-secondary font-bold">{k?.ncdScreened ?? 0} NCD screened</p>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-5 rounded-xl border border-error-container bg-error-container/10 flex items-center gap-4">
                <div className="p-3 bg-error text-on-error rounded-lg">
                  <span className="material-symbols-outlined text-[28px]">report_problem</span>
                </div>
                <div>
                  <p className="text-caption text-on-error-container font-medium">High-Risk Patients</p>
                  <h3 className="text-display-lg text-error">{k?.hrpActive ?? 0}</h3>
                  <p className="text-caption text-on-error-container">{k?.activePregnancies ?? 0} active pregnancies</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <section className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                  <h2 className="text-headline-md text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-error">notification_important</span>
                    Critical Alerts
                  </h2>
                  <Link to="/phc/alerts" className="text-label-md text-primary hover:underline">View All</Link>
                </div>
                <div className="p-4 space-y-3">
                  {alerts.length === 0 && (
                    <p className="text-body-md text-on-surface-variant p-4">No critical alerts right now.</p>
                  )}
                  {alerts.map((a) => (
                    <div key={a.id} className="flex items-start gap-4 p-4 rounded-lg bg-error-container/20 border-l-4 border-error">
                      <div className="text-error mt-0.5">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: '\'FILL\' 1' }}>warning</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-on-error-container">{a.beneficiaryName}</h4>
                        <p className="text-body-md text-on-surface-variant">{a.reason} · {a.village} · {a.ashaName}</p>
                        <div className="mt-2 flex gap-2">
                          <Link to={`/phc/beneficiaries/${a.beneficiaryId}`} className="px-3 py-1 bg-error text-on-error text-caption rounded-lg font-bold">View Record</Link>
                          <Link to="/phc/alerts" className="px-3 py-1 border border-outline-variant text-caption rounded-lg hover:bg-surface">Manage Alerts</Link>
                        </div>
                      </div>
                      <span className="text-caption text-outline whitespace-nowrap">{timeAgo(a.detectedAt)}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 flex flex-col items-center justify-center relative">
                <h3 className="text-label-md text-outline-variant self-start mb-4 uppercase tracking-wider">Immunization Coverage</h3>
                <div className="relative size-48">
                  <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                    <circle className="stroke-surface-container" cx="18" cy="18" fill="none" r="16" strokeWidth="3"></circle>
                    <circle className="stroke-primary" cx="18" cy="18" fill="none" r="16" strokeDasharray={`${immunization}, 100`} strokeLinecap="round" strokeWidth="3"></circle>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-display-lg text-on-surface">{immunization}%</span>
                    <span className="text-caption text-outline">Coverage</span>
                  </div>
                </div>
                <div className="mt-6 w-full space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-caption font-medium">
                      <div className="size-2 rounded-full bg-primary"></div> Completed
                    </span>
                    <span className="text-label-md">{vaccinationDone.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-caption font-medium">
                      <div className="size-2 rounded-full bg-surface-container"></div> Pending
                    </span>
                    <span className="text-label-md">{vaccinationPending.toLocaleString()}</span>
                  </div>
                </div>
                <Link to="/phc/vaccination" className="mt-4 w-full py-2 bg-surface-container hover:bg-surface-container-high rounded-lg text-label-md text-primary font-bold text-center transition-colors">Details Report</Link>
              </section>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-headline-md">Coverage Trend</h3>
                  <select className="text-caption rounded-lg border-outline-variant bg-surface-bright focus:ring-primary" defaultValue="Last 6 Months">
                    <option>Last 6 Months</option>
                    <option>Last Year</option>
                  </select>
                </div>
                <div className="h-64 flex items-end justify-between gap-2">
                  {trend.map((p) => {
                    const h = Math.max(8, Math.round((p.immunization / maxTrend) * 100))
                    return (
                      <div key={p.label} className="flex flex-col items-center flex-1 gap-2">
                        <div className="w-full bg-primary/70 rounded-t-lg" style={{ height: `${h}%` }} title={`${p.label}: ${p.immunization}%`}></div>
                        <span className="text-[10px] text-outline">{p.label.toUpperCase()}</span>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-4 text-caption text-secondary font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">trending_up</span>
                  Immunization coverage across {k?.villageCount ?? 5} villages
                </p>
              </section>
              <section className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low">
                  <h2 className="text-headline-md text-on-surface">Recent Activity</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-container-lowest">
                      <tr>
                        <th className="px-6 py-3 text-caption font-bold text-outline uppercase">Worker</th>
                        <th className="px-6 py-3 text-caption font-bold text-outline uppercase">Device</th>
                        <th className="px-6 py-3 text-caption font-bold text-outline uppercase">Records</th>
                        <th className="px-6 py-3 text-caption font-bold text-outline uppercase">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {syncs.map((s) => (
                        <tr key={s.id}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="size-8 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary">{initials(s.ashaName)}</div>
                              <span className="text-label-md">{s.ashaName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-body-md font-mono text-sm">{s.deviceId}</td>
                          <td className="px-6 py-4 text-body-md">{s.recordsSynced}</td>
                          <td className="px-6 py-4 text-caption text-outline">{timeAgo(s.syncedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
