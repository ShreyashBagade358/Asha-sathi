import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { pregnancyService } from '@/services/pregnancy.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'

function trimesterFromLmp(lmp: string): number {
  if (!lmp) return 0
  const start = new Date(lmp).getTime()
  if (Number.isNaN(start)) return 0
  const now = Date.now()
  const weeks = Math.max(0, Math.floor((now - start) / (7 * 86400000)))
  if (weeks <= 13) return 1
  if (weeks <= 26) return 2
  return 3
}

function weekFromLmp(lmp: string): number {
  if (!lmp) return 0
  const start = new Date(lmp).getTime()
  if (Number.isNaN(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / (7 * 86400000)))
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PregnantWomenListPhcAdmin() {
  const [search, setSearch] = useState('')
  const [village, setVillage] = useState('All')
  const [risk, setRisk] = useState('All')
  const [trimester, setTrimester] = useState('All')
  const [page, setPage] = useState(1)
  const perPage = 10

  const { data: pregData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pregnancies', page],
    queryFn: () => pregnancyService.listPregnancies({ page, pageSize: perPage }),
  })

  const { data: benData } = useQuery({
    queryKey: ['beneficiaries-map'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })

  const beneficiaryMap = useMemo(() => {
    const m = new Map<string, { name: string; village: string }>()
    for (const b of benData?.items ?? []) {
      m.set(b.id, { name: b.name, village: b.village })
    }
    return m
  }, [benData])

  const pregnancies = pregData?.items ?? []

  const filtered = useMemo(() => {
    let list = pregnancies.map((p) => {
      const ben = beneficiaryMap.get(p.beneficiaryId)
      const trimesterVal = trimesterFromLmp(p.lmp)
      return {
        ...p,
        patientName: ben?.name ?? '—',
        village: ben?.village ?? '—',
        trimester: trimesterVal === 0 ? null : trimesterVal,
        week: weekFromLmp(p.lmp),
        risk: p.hrpLevel ?? 'low',
      }
    })
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.patientName.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      )
    }
    if (village !== 'All') list = list.filter((p) => p.village === village)
    if (risk !== 'All') list = list.filter((p) => p.risk === risk)
    if (trimester !== 'All') list = list.filter((p) => String(p.trimester) === trimester)
    return list
  }, [pregnancies, beneficiaryMap, search, village, risk, trimester])

  const totalCount = pregData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage))
  const paged = filtered

  const trimesterLabel = (t: number | null) =>
    t === null ? '—' : `${t}${t === 1 ? 'st' : t === 2 ? 'nd' : 'rd'} Trimester`

  const riskColor = (r: string) =>
    r === 'high'
      ? 'bg-error-container text-on-error-container'
      : r === 'medium'
        ? 'bg-tertiary-container text-on-tertiary'
        : 'bg-secondary-container text-on-secondary-container'

  const riskDot = (r: string) =>
    r === 'high' ? 'bg-error' : r === 'medium' ? 'bg-tertiary' : 'bg-secondary'

  const riskStrip = (r: string) =>
    r === 'high' ? 'bg-error' : r === 'medium' ? 'bg-tertiary' : 'bg-secondary'

  const hasFilter = village !== 'All' || risk !== 'All' || trimester !== 'All' || search.trim()

  const stats = useMemo(
    () => ({
      total: totalCount,
      highRisk: pregnancies.filter((p) => p.highRisk).length,
      dueThisMonth: pregnancies.filter((p) => {
        const t = trimesterFromLmp(p.lmp)
        return t === 3
      }).length,
      recent: pregnancies.filter((p) => {
        if (!p.registeredAt) return false
        const d = new Date(p.registeredAt)
        const now = new Date()
        return d > new Date(now.getTime() - 30 * 86400000)
      }).length,
    }),
    [pregnancies, totalCount]
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[22px]">pregnant_woman</span>
            <div>
              <h2 className="text-headline-sm text-on-surface">Pregnant Women Directory</h2>
              <p className="text-caption text-on-surface-variant hidden md:block">Manage and monitor maternal health records.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-caption text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              Synced
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Pregnancies', value: stats.total, color: 'text-primary', bg: 'bg-primary-container/10', border: 'border-outline-variant' },
                { label: 'High-Risk Cases', value: stats.highRisk, color: 'text-error', bg: 'bg-error-container/20', border: 'border-error-container' },
                { label: 'Due this Month', value: stats.dueThisMonth, color: 'text-tertiary', bg: 'bg-tertiary-container/10', border: 'border-outline-variant' },
                { label: 'Recent Registrations', value: stats.recent, color: 'text-secondary', bg: 'bg-secondary-container/10', border: 'border-outline-variant' },
              ].map((s) => (
                <div key={s.label} className={`bg-surface-container-lowest p-4 rounded-xl border ${s.border} relative overflow-hidden group hover:shadow-sm transition-all`}>
                  <div className={`absolute -right-4 -top-4 w-24 h-24 ${s.bg} rounded-full group-hover:scale-110 transition-transform`} />
                  <p className="text-caption text-on-surface-variant relative z-10">{s.label}</p>
                  <h3 className={`text-headline-lg ${s.color} relative z-10 mt-1`}>{s.value}</h3>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between bg-surface-container-low p-3 rounded-xl border border-outline-variant">
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
                  <input
                    className="h-10 w-full rounded-lg border border-outline bg-surface pl-10 pr-4 text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Search by name or ID..."
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  />
                </div>
                {[{ label: 'All Villages', value: village, set: setVillage, opts: ['All', ...Array.from(new Set(benData?.items?.map((b) => b.village).filter(Boolean) ?? []))] }, { label: 'Risk Level', value: risk, set: setRisk, opts: ['All', 'high', 'medium', 'low'] }, { label: 'Trimester', value: trimester, set: setTrimester, opts: ['All', '1', '2', '3'] }].map((f) => (
                  <div key={f.label} className="relative">
                    <select
                      className="h-10 appearance-none rounded-lg border border-outline bg-surface px-3 pr-8 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      value={f.value}
                      onChange={(e) => { f.set(e.target.value); setPage(1) }}
                    >
                      {f.opts.map((o) => (
                        <option key={o} value={o}>{o === 'All' ? f.label : o === '1' ? '1st' : o === '2' ? '2nd' : o === '3' ? '3rd' : o.charAt(0).toUpperCase() + o.slice(1)}</option>
                      ))}
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[16px] pointer-events-none">expand_more</span>
                  </div>
                ))}
              </div>
              {hasFilter && (
                <button
                  className="text-caption text-primary hover:text-on-primary-fixed-variant font-semibold transition-colors whitespace-nowrap"
                  onClick={() => { setSearch(''); setVillage('All'); setRisk('All'); setTrimester('All'); setPage(1) }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              {isLoading && <LoadingState label="Loading pregnancies…" />}
              {isError && <div className="p-4"><ErrorState message={getErrorMessage(error)} onRetry={refetch} /></div>}
              {!isLoading && !isError && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant bg-surface-container-low">
                        <th className="px-5 py-3 text-label-md text-on-surface-variant font-semibold whitespace-nowrap">Patient Name / ID</th>
                        <th className="px-5 py-3 text-label-md text-on-surface-variant font-semibold whitespace-nowrap">EDD</th>
                        <th className="px-5 py-3 text-label-md text-on-surface-variant font-semibold whitespace-nowrap">Timeline</th>
                        <th className="px-5 py-3 text-label-md text-on-surface-variant font-semibold whitespace-nowrap">Last ANC</th>
                        <th className="px-5 py-3 text-label-md text-on-surface-variant font-semibold whitespace-nowrap">Risk Status</th>
                        <th className="px-5 py-3 text-label-md text-on-surface-variant font-semibold whitespace-nowrap">ASHA Worker</th>
                        <th className="px-5 py-3 text-label-md text-on-surface-variant font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/50">
                      {paged.map((p) => (
                        <tr key={p.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-5 py-4 relative">
                            <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${riskStrip(p.risk)}`} />
                            <div className="font-semibold text-on-surface pl-2">{p.patientName}</div>
                            <div className="text-caption text-on-surface-variant pl-2">PW-{p.id.replace(/-/g, '').slice(0, 6).toUpperCase()}</div>
                          </td>
                          <td className="px-5 py-4 text-on-surface whitespace-nowrap">{formatDate(p.edd)}</td>
                          <td className="px-5 py-4">
                            <div className="text-on-surface">{p.week > 0 ? `Week ${p.week}` : '—'}</div>
                            <div className="text-caption text-on-surface-variant">{trimesterLabel(p.trimester)}</div>
                          </td>
                          <td className="px-5 py-4 text-on-surface">—</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-medium ${riskColor(p.risk)}`}>
                              <span className={`w-2 h-2 rounded-full ${riskDot(p.risk)}`} />
                              {p.risk.charAt(0).toUpperCase() + p.risk.slice(1)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-on-surface">—</td>
                          <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                            <button className="text-primary hover:text-primary-fixed font-label-md text-label-md px-2 py-1 min-h-[36px]">
                              Details
                            </button>
                            <button className="border border-primary text-primary hover:bg-primary-container/10 px-3 py-1 rounded-lg font-label-md text-label-md min-h-[36px]">
                              Log Visit
                            </button>
                          </td>
                        </tr>
                      ))}
                      {paged.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-5 py-16 text-center">
                            <span className="material-symbols-outlined text-on-surface-variant/40 text-[48px] mb-2 block">pregnant_woman</span>
                            <p className="text-on-surface-variant font-medium">No pregnant women found</p>
                            <p className="text-caption text-on-surface-variant/60 mt-1">
                              {hasFilter ? 'Try adjusting your filters' : 'No pregnancies registered yet'}
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-5 py-3 border-t border-outline-variant bg-surface-container-low flex justify-between items-center text-body-sm text-on-surface-variant">
                <span>
                  {totalCount === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, totalCount)} of {totalCount}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="p-1 rounded-lg hover:bg-surface-container-highest disabled:opacity-40 transition-colors"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                  <span className="text-label-sm text-on-surface">
                    {page} / {totalPages}
                  </span>
                  <button
                    className="p-1 rounded-lg hover:bg-surface-container-highest disabled:opacity-40 transition-colors"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
