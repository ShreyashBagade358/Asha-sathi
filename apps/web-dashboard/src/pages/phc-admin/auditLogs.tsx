import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { auditService } from '@/services/audit.service'
import type { AuditLogEntry } from '@/types'

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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const q = search.trim()

  const logsQ = useQuery({
    queryKey: ['audit', 'logs', page, statusFilter, q],
    queryFn: () =>
      auditService.listLogs({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: q || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const summaryQ = useQuery({
    queryKey: ['audit', 'summary'],
    queryFn: () => auditService.getSummary(),
  })

  const logsList = logsQ.data?.items ?? []
  const total = logsQ.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const paged = logsList
  const counts = summaryQ.data ?? { total: 0, success: 0, denied: 0, error: 0 }

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
                    Showing {total === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
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
