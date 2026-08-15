import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardService } from '@/services/dashboard.service'
import type { HRPAlert, AlertStatus } from '@/types'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.max(1, Math.round(diff / 60000))
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

export default function AlertsNotificationsDashboardPhcAdmin() {
  const [alerts, setAlerts] = useState<HRPAlert[]>([])
  const [priority, setPriority] = useState<'all' | 'high' | 'medium'>('all')
  const [status, setStatus] = useState<'all' | AlertStatus>('all')

  useEffect(() => {
    let active = true
    dashboardService.getPHCDashboard('phc-demo').then((d) => {
      if (active) setAlerts(d.hrpAlerts)
    })
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(
    () =>
      alerts.filter((a) => {
        if (priority !== 'all' && a.hrpLevel !== priority) return false
        if (status !== 'all' && a.status !== status) return false
        return true
      }),
    [alerts, priority, status],
  )

  const criticalCount = alerts.filter((a) => a.hrpLevel === 'high').length
  const openCount = alerts.filter((a) => a.status === 'open').length

  const acknowledge = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: a.status === 'open' ? ('acknowledged' as const) : a.status } : a)),
    )
  }

  const alertTone = (a: HRPAlert) =>
    a.hrpLevel === 'high' ? 'border-l-4 border-l-error' : 'border-l-4 border-l-tertiary-container'

  const alertIcon = (a: HRPAlert) =>
    a.hrpLevel === 'high' ? (
      <span className="material-symbols-outlined text-error" style={{ fontVariationSettings: '\'FILL\' 1' }}>error</span>
    ) : (
      <span className="material-symbols-outlined text-tertiary-container" style={{ fontVariationSettings: '\'FILL\' 1' }}>warning</span>
    )

  const statusBadge = (a: HRPAlert) => {
    if (a.status === 'resolved') {
      return <span className="inline-flex items-center px-2 py-1 rounded-full bg-secondary-container text-on-secondary-container font-caption text-caption font-bold">Resolved</span>
    }
    if (a.status === 'acknowledged') {
      return <span className="inline-flex items-center px-2 py-1 rounded-full bg-surface-container-high text-on-surface font-caption text-caption font-bold">Acknowledged</span>
    }
    return <span className="inline-flex items-center px-2 py-1 rounded-full bg-error-container text-on-error-container font-caption text-caption font-bold">Open</span>
  }

  return (
    <>
      <nav className="fixed left-0 top-0 h-full w-64 flex flex-col pt-xxl pb-lg z-40 bg-surface-container-low dark:bg-surface-container-low border-r border-outline-variant hidden md:flex">
        <div className="px-md mb-xl flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary-container text-[40px]" style={{ fontVariationSettings: '\'FILL\' 1' }}>local_hospital</span>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary-container dark:text-primary-fixed">PHC Connect</h1>
            <p className="font-caption text-caption text-on-surface-variant">District Division A-12</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-xs px-sm">
          <Link className="flex items-center gap-md text-on-surface-variant dark:text-on-surface-variant mx-sm my-xs px-md py-sm hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all rounded-lg active:scale-95 duration-150" to="/phc/dashboard">
            <span className="material-symbols-outlined">dashboard</span>
            Dashboard
          </Link>
          <Link className="flex items-center gap-md text-on-surface-variant dark:text-on-surface-variant mx-sm my-xs px-md py-sm hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all rounded-lg active:scale-95 duration-150" to="/phc/ashas">
            <span className="material-symbols-outlined">groups</span>
            Workers
          </Link>
          <Link className="flex items-center gap-md text-on-surface-variant dark:text-on-surface-variant mx-sm my-xs px-md py-sm hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all rounded-lg active:scale-95 duration-150" to="/phc/beneficiaries">
            <span className="material-symbols-outlined">person_heart</span>
            Beneficiaries
          </Link>
          <Link className="flex items-center gap-md bg-primary-container text-on-primary-container rounded-lg mx-sm my-xs px-md py-sm font-bold active:scale-95 duration-150" to="/phc/alerts">
            <span className="material-symbols-outlined">notification_important</span>
            Alerts
          </Link>
          <Link className="flex items-center gap-md text-on-surface-variant dark:text-on-surface-variant mx-sm my-xs px-md py-sm hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all rounded-lg active:scale-95 duration-150" to="/phc/maternal">
            <span className="material-symbols-outlined">pregnant_woman</span>
            Maternal Health
          </Link>
          <Link className="flex items-center gap-md text-on-surface-variant dark:text-on-surface-variant mx-sm my-xs px-md py-sm hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all rounded-lg active:scale-95 duration-150" to="/phc/vaccination">
            <span className="material-symbols-outlined">inventory_2</span>
            Inventory
          </Link>
        </div>
        <div className="mt-auto px-sm pt-md border-t border-outline-variant space-y-xs">
          <a className="flex items-center gap-md text-on-surface-variant dark:text-on-surface-variant mx-sm my-xs px-md py-sm hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all rounded-lg active:scale-95 duration-150" href="#">
            <span className="material-symbols-outlined">help</span>
            Support
          </a>
        </div>
      </nav>
      <main className="flex-1 flex flex-col h-full md:ml-64 w-full">
        <header className="bg-surface-container-lowest dark:bg-surface-container-lowest border-b border-outline-variant dark:border-outline-variant shadow-sm h-touch-target flex items-center justify-between px-lg shrink-0">
          <div className="flex items-center gap-sm md:hidden">
            <span className="material-symbols-outlined text-primary text-[32px]" style={{ fontVariationSettings: '\'FILL\' 1' }}>local_hospital</span>
            <span className="font-headline-md text-headline-md text-primary font-bold">PHC Connect</span>
          </div>
          <div className="hidden md:flex items-center gap-sm">
            <h2 className="font-headline-md text-headline-md text-on-surface">Alerts & Notifications Dashboard</h2>
          </div>
          <div className="flex items-center gap-md text-primary dark:text-primary-fixed-dim">
            <button className="hover:bg-surface-container-low dark:hover:bg-surface-container-low transition-colors p-sm rounded-full cursor-pointer active:opacity-80">
              <span className="material-symbols-outlined">sync</span>
            </button>
            <button className="hover:bg-surface-container-low dark:hover:bg-surface-container-low transition-colors p-sm rounded-full cursor-pointer active:opacity-80 relative">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: '\'FILL\' 1' }}>notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-md lg:p-lg bg-surface">
          <div className="max-w-7xl mx-auto space-y-lg">
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-md">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm flex flex-col">
                <div className="flex items-center gap-sm mb-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary-container">notifications_active</span>
                  <span className="font-label-md text-label-md">Total HRP Alerts</span>
                </div>
                <span className="font-display-lg text-display-lg text-on-surface font-bold">{alerts.length}</span>
              </div>
              <div className="bg-surface-container-lowest border-l-4 border-error rounded-xl p-md shadow-sm flex flex-col border-y border-r border-outline-variant">
                <div className="flex items-center gap-sm mb-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-error">warning</span>
                  <span className="font-label-md text-label-md">High Risk</span>
                </div>
                <span className="font-display-lg text-display-lg text-error font-bold">{criticalCount}</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm flex flex-col">
                <div className="flex items-center gap-sm mb-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-secondary">vaccines</span>
                  <span className="font-label-md text-label-md">Open Alerts</span>
                </div>
                <span className="font-display-lg text-display-lg text-on-surface font-bold">{openCount}</span>
              </div>
              <div className="bg-surface-container-lowest border-l-4 border-tertiary-container rounded-xl p-md shadow-sm flex flex-col border-y border-r border-outline-variant">
                <div className="flex items-center gap-sm mb-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-tertiary-container">medium_priority</span>
                  <span className="font-label-md text-label-md">Medium Risk</span>
                </div>
                <span className="font-display-lg text-display-lg text-tertiary-container font-bold">{alerts.filter((a) => a.hrpLevel === 'medium').length}</span>
              </div>
            </section>
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm flex flex-col h-[600px]">
              <div className="p-md border-b border-outline-variant bg-surface-bright flex flex-col lg:flex-row gap-md justify-between items-start lg:items-center rounded-t-xl">
                <h3 className="font-headline-md text-headline-md text-on-surface">Recent Alerts</h3>
                <div className="flex flex-wrap gap-sm">
                  <select className="form-select bg-surface border-outline-variant text-on-surface-variant font-body-md rounded-lg py-sm px-md h-touch-target focus:ring-primary focus:border-primary" value={priority} onChange={(e) => setPriority(e.target.value as 'all' | 'high' | 'medium')}>
                    <option value="all">Priority: All</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                  </select>
                  <select className="form-select bg-surface border-outline-variant text-on-surface-variant font-body-md rounded-lg py-sm px-md h-touch-target focus:ring-primary focus:border-primary" value={status} onChange={(e) => setStatus(e.target.value as 'all' | AlertStatus)}>
                    <option value="all">Status: All</option>
                    <option value="open">Open</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-0">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container sticky top-0 z-10">
                    <tr>
                      <th className="p-sm font-label-md text-label-md text-on-surface-variant border-b border-outline-variant w-12 text-center"></th>
                      <th className="p-sm font-label-md text-label-md text-on-surface-variant border-b border-outline-variant">Patient</th>
                      <th className="p-sm font-label-md text-label-md text-on-surface-variant border-b border-outline-variant">Reason</th>
                      <th className="p-sm font-label-md text-label-md text-on-surface-variant border-b border-outline-variant">Location</th>
                      <th className="p-sm font-label-md text-label-md text-on-surface-variant border-b border-outline-variant">Timestamp</th>
                      <th className="p-sm font-label-md text-label-md text-on-surface-variant border-b border-outline-variant">Status</th>
                      <th className="p-sm font-label-md text-label-md text-on-surface-variant border-b border-outline-variant text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-sm py-12 text-center text-on-surface-variant">No alerts match the selected filters.</td>
                      </tr>
                    )}
                    {filtered.map((a) => (
                      <tr key={a.id} className={`hover:bg-surface-container-low transition-colors group ${alertTone(a)}`}>
                        <td className="p-sm text-center">{alertIcon(a)}</td>
                        <td className="p-sm">
                          <Link to={`/phc/beneficiaries/${a.beneficiaryId}`} className="hover:opacity-80">
                            <p className="font-label-md text-label-md text-on-surface">{a.beneficiaryName}</p>
                            <p className="font-caption text-caption text-on-surface-variant">ID: {a.beneficiaryId.toUpperCase()}</p>
                          </Link>
                        </td>
                        <td className="p-sm">
                          <p className="font-body-md text-body-md text-on-surface">{a.reason}</p>
                          <p className="font-caption text-caption text-on-surface-variant">{a.ashaName}</p>
                        </td>
                        <td className="p-sm">
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-error-container text-on-error-container font-caption text-caption font-bold">HRP · {a.village}</span>
                        </td>
                        <td className="p-sm">
                          <p className="font-body-md text-body-md text-on-surface-variant">{timeAgo(a.detectedAt)}</p>
                        </td>
                        <td className="p-sm">{statusBadge(a)}</td>
                        <td className="p-sm text-right">
                          <div className="flex gap-sm justify-end">
                            <Link to={`/phc/beneficiaries/${a.beneficiaryId}`} className="border border-outline text-primary font-label-md text-label-md px-md py-sm rounded-lg hover:bg-surface-container transition-colors">View Details</Link>
                            {a.status !== 'resolved' && (
                              <button onClick={() => acknowledge(a.id)} className="bg-primary text-on-primary font-label-md text-label-md px-md py-sm rounded-lg hover:bg-primary-container transition-colors">
                                {a.status === 'open' ? 'Acknowledge' : 'Mark Resolved'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
