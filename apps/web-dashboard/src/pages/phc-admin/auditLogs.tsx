import { useState } from 'react'
import { useAppStore } from '@/stores/app.store'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import type { AuditLogEntry } from '@/types'

const ACTORS = ['S. Devi', 'A. Kumari', 'R. Singh', 'P. Sharma', 'K. Verma']
const PAGE_SIZE = 10

const ACTION_META: Record<AuditLogEntry['action'], { icon: string; color: string }> = {
  login: { icon: 'shield', color: 'text-tertiary' },
  logout: { icon: 'shield', color: 'text-tertiary' },
  create: { icon: 'add_circle', color: 'text-secondary' },
  update: { icon: 'edit', color: 'text-tertiary' },
  delete: { icon: 'delete', color: 'text-error' },
  export: { icon: 'download', color: 'text-primary' },
  config_change: { icon: 'settings', color: 'text-on-surface-variant' },
  policy_change: { icon: 'policy', color: 'text-on-surface-variant' },
  user_management: { icon: 'group', color: 'text-primary' },
}

const STATUS_META: Record<string, { bg: string; text: string; dot: string }> = {
  success: { bg: 'bg-secondary-container', text: 'text-on-secondary-container', dot: 'bg-secondary' },
  denied: { bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', dot: 'bg-tertiary' },
  error: { bg: 'bg-error-container', text: 'text-on-error-container', dot: 'bg-error' },
}

function useAuditLogs(): AuditLogEntry[] {
  const checkups = useAppStore((s) => s.checkups)
  const referrals = useAppStore((s) => s.referrals)
  const notifications = useAppStore((s) => s.notifications)
  const ashaWorkers = useAppStore((s) => s.ashaWorkers)
  const patients = useAppStore((s) => s.patients)

  const logs: AuditLogEntry[] = []

  checkups.slice(0, 5).forEach((c, i) => {
    logs.push({
      id: `log-ck-${c.id}`,
      timestamp: new Date(Date.now() - i * 36e5).toISOString(),
      actorId: `u-${(i % 3) + 1}`,
      actorName: ACTORS[i % ACTORS.length],
      actorRole: 'moic',
      action: 'create',
      resource: 'checkup',
      resourceId: c.id,
      details: `Health checkup recorded for ${c.village}`,
      ip: '10.20.1.15',
      status: 'success',
    })
  })

  referrals.slice(0, 5).forEach((r, i) => {
    logs.push({
      id: `log-rf-${r.id}`,
      timestamp: new Date(Date.now() - (i + 5) * 36e5).toISOString(),
      actorId: `u-${(i % 3) + 1}`,
      actorName: ACTORS[i % ACTORS.length],
      actorRole: 'moic',
      action: i % 2 === 0 ? 'create' : 'update',
      resource: 'referral',
      resourceId: r.id,
      details: `Referral ${r.status} for ${r.patientName}`,
      ip: '10.20.1.15',
      status: 'success',
    })
  })

  notifications.slice(0, 3).forEach((n, i) => {
    logs.push({
      id: `log-n-${n.id}`,
      timestamp: new Date(Date.now() - (i + 10) * 36e5).toISOString(),
      actorId: 'u-system',
      actorName: 'System',
      actorRole: 'moic',
      action: 'create',
      resource: 'notification',
      resourceId: n.id,
      details: n.title,
      status: 'success',
    })
  })

  ashaWorkers.slice(0, 3).forEach((w, i) => {
    logs.push({
      id: `log-aw-${w.id}`,
      timestamp: new Date(Date.now() - (i + 13) * 36e5).toISOString(),
      actorId: `u-${(i % 3) + 1}`,
      actorName: ACTORS[i % ACTORS.length],
      actorRole: 'moic',
      action: 'create',
      resource: 'asha_worker',
      resourceId: w.ashaId,
      details: `ASHA worker ${w.name} registered`,
      ip: '10.20.1.15',
      status: 'success',
    })
  })

  patients.slice(0, 3).forEach((p, i) => {
    logs.push({
      id: `log-pt-${p.id}`,
      timestamp: new Date(Date.now() - (i + 16) * 36e5).toISOString(),
      actorId: `u-${(i % 3) + 1}`,
      actorName: ACTORS[i % ACTORS.length],
      actorRole: 'moic',
      action: 'create',
      resource: 'beneficiary',
      resourceId: p.id,
      details: `Patient ${p.name} registered`,
      ip: '10.20.1.15',
      status: 'success',
    })
  })

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function formatTimestamp(ts: string) {
  const d = new Date(ts)
  return {
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    relative: getTimeAgo(d),
  }
}

function getTimeAgo(d: Date) {
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function AuditLogsPhcAdmin() {
  const logs = useAuditLogs()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const logsList = logs.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!l.details.toLowerCase().includes(q) && !l.resource.toLowerCase().includes(q) && !l.actorName.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalPages = Math.ceil(logsList.length / PAGE_SIZE)
  const paged = logsList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const counts = {
    total: logs.length,
    success: logs.filter((l) => l.status === 'success').length,
    denied: logs.filter((l) => l.status === 'denied').length,
    error: logs.filter((l) => l.status === 'error').length,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 text-on-surface-variant">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <h2 className="text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">history</span>
                Audit Logs
              </h2>
              <p className="text-caption text-on-surface-variant">{counts.total} events · {counts.success} success · {counts.denied + counts.error} flagged</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant text-label-md text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
              Synced
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Total Events</span>
                <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">history</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{counts.total}</div>
              <div className="text-caption text-on-surface-variant mt-1">All recorded</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Successful</span>
                <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                </div>
              </div>
              <div className="text-display-lg text-secondary font-display-lg">{counts.success}</div>
              <div className="text-caption text-on-surface-variant mt-1">Normal operations</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Denied</span>
                <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">block</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{counts.denied}</div>
              <div className="text-caption text-on-surface-variant mt-1">Access blocked</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-error"></div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Errors</span>
                <div className="bg-error-container text-on-error-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                </div>
              </div>
              <div className="text-display-lg font-display-lg text-error">{counts.error}</div>
              <div className="text-caption text-on-surface-variant mt-1">Needs attention</div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="flex flex-col gap-3 p-5 md:flex-row md:items-end border-b border-outline-variant/50">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-label-md text-on-surface-variant">Search</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px]">search</span>
                  </span>
                  <input
                    className="h-12 w-full rounded-lg bg-white border border-gray-200 pl-11 pr-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    type="text"
                    placeholder="Search actor, resource, details..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1 md:w-48">
                <label className="text-label-md text-on-surface-variant">Status</label>
                <div className="relative">
                  <select
                    className="h-12 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface appearance-none transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                  >
                    <option value="all">All</option>
                    <option value="success">Success</option>
                    <option value="denied">Denied</option>
                    <option value="error">Error</option>
                  </select>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-on-surface-variant pointer-events-none">
                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                  </span>
                </div>
              </div>
            </div>

            {paged.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
                <span className="material-symbols-outlined text-[48px] text-outline mb-2 block">search_off</span>
                <p className="text-sm text-on-surface-variant">No matching audit logs.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-outline-variant/50 bg-surface-container-low/50">
                        <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Date</th>
                        <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Actor</th>
                        <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Action</th>
                        <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Resource</th>
                        <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Details</th>
                        <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((log, index) => {
                        const ts = formatTimestamp(log.timestamp)
                        const statusMeta = STATUS_META[log.status] ?? STATUS_META.success
                        return (
                          <tr
                            key={log.id}
                            className={`transition-colors hover:bg-surface-container-low/40 even:bg-gray-50/50 ${
                              index < paged.length - 1 ? 'border-b border-outline-variant/40' : ''
                            }`}
                          >
                            <td className="whitespace-nowrap px-5 py-3">
                              <span className="text-body-md text-on-surface">{ts.date}</span>
                              <span className="block text-caption text-on-surface-variant">{ts.relative}</span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="text-body-md font-medium text-on-surface">{log.actorName}</span>
                              <span className="block text-caption text-on-surface-variant capitalize">{log.actorRole.replace('_', ' ')}</span>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3">
                              <span className="inline-flex items-center gap-1.5 text-body-md capitalize text-on-surface">
                                <span className={`material-symbols-outlined text-[16px] ${ACTION_META[log.action].color}`}>{ACTION_META[log.action].icon}</span>
                                {log.action.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-label-md text-on-surface-variant font-mono">
                              {log.resource}{log.resourceId ? `/${log.resourceId}` : ''}
                            </td>
                            <td className="px-5 py-3 text-body-md text-on-surface-variant max-w-xs truncate">{log.details}</td>
                            <td className="whitespace-nowrap px-5 py-3">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.bg} ${statusMeta.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`}></span>
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t border-outline-variant/50 px-5 py-3">
                  <span className="text-caption text-on-surface-variant">
                    Showing {Math.min((page - 1) * PAGE_SIZE + 1, logsList.length)}–{Math.min(page * PAGE_SIZE, logsList.length)} of {logsList.length}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i + 1}
                        type="button"
                        onClick={() => setPage(i + 1)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-label-md transition-colors ${
                          page === i + 1 ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
