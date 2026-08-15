import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { beneficiaryService, type BeneficiaryStatus } from '@/services/beneficiary.service'
import type { Beneficiary } from '@/types'

const VILLAGES = ['Rampur', 'Sonpur', 'Kandwa', 'Tikari', 'Basari']

function categoryOf(b: Beneficiary): string {
  if (b.isPregnant) return 'ANC'
  if (b.hasChild) return 'PNC / Child'
  return 'Eligible'
}

function statusOf(b: Beneficiary): { label: string; tone: string } {
  if (b.isPregnant) return { label: 'Antenatal care', tone: 'text-primary font-label-md text-[13px]' }
  if (b.hasChild) return { label: 'Child follow-up', tone: 'text-secondary font-label-md text-[13px]' }
  return { label: 'Due for screening', tone: 'text-on-surface font-label-md text-[13px]' }
}

export default function BeneficiaryDirectoryPhcAdmin() {
  const [rows, setRows] = useState<Beneficiary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [village, setVillage] = useState('')
  const [category, setCategory] = useState<'all' | BeneficiaryStatus>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const load = async (p: number, q: string, v: string, c: 'all' | BeneficiaryStatus) => {
    setLoading(true)
    try {
      const res = await beneficiaryService.listBeneficiaries({
        search: q || undefined,
        village: v || undefined,
        status: c === 'all' ? undefined : c,
        page: p,
        pageSize: 10,
      })
      setRows(res.items)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(page, search, village, category)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const applyFilters = () => {
    setPage(1)
    load(1, search, village, category)
  }

  const resetFilters = () => {
    setSearch('')
    setVillage('')
    setCategory('all')
    setPage(1)
    load(1, '', '', 'all')
  }

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exportCsv = () => {
    const rowsToExport = rows.filter((r) => selected.size === 0 || selected.has(r.id))
    beneficiaryService.exportCSV(rowsToExport, 'beneficiaries.csv')
  }

  return (
    <>
      <nav className="bg-surface-container-low dark:bg-surface-dim h-screen w-64 fixed left-0 top-0 flex flex-col h-full border-r border-outline-variant dark:border-outline z-30 hidden md:flex">
        <div className="p-lg flex items-center gap-md">
          <img className="w-10 h-10 rounded-full object-cover shrink-0" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCO8pNMtg1UbIbGGhdtQLunbkqUYaen70bmgIUPww4vsLifA73Cgg8vx20e0eF7rpp95pKGY4XYVGgQH4IiH1LWgNKALeDAvctnQba0bdPArjejC7otB18duhjhdI_POJF4nDx_jAO93yq4u3mS7Ti8qtzc1_k6o31Ov5U6IfNk7KLm7-XN3KzxlcNn2XGgdo_uiw1J4ivlewVOP80yKqOhP2nYY9NNHJi1caYx9MjDuoK4fTpgkl0V-w" />
          <div>
            <h1 className="font-headline-md text-headline-md font-extrabold text-primary dark:text-primary-fixed">PHC Administration</h1>
            <p className="font-caption text-caption text-on-surface-variant">Rural Health Network</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-sm">
          <Link className="flex items-center gap-md px-lg py-md text-on-surface-variant dark:text-outline-variant hover:bg-surface-container dark:hover:bg-surface-container-high transition-all duration-200 ease-in-out font-label-md text-label-md group" to="/phc/dashboard">
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">dashboard</span>
            Dashboard
          </Link>
          <Link className="flex items-center gap-md px-lg py-md text-on-surface-variant dark:text-outline-variant hover:bg-surface-container dark:hover:bg-surface-container-high transition-all duration-200 ease-in-out font-label-md text-label-md group" to="/phc/ashas">
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">groups</span>
            Workers
          </Link>
          <Link className="flex items-center gap-md px-lg py-md text-primary dark:text-primary-fixed font-bold border-r-4 border-primary dark:border-primary-fixed bg-surface-container-high dark:bg-surface-container-highest transition-all duration-200 ease-in-out font-label-md text-label-md" to="/phc/beneficiaries">
            <span className="material-symbols-outlined fill-icon text-primary">person</span>
            Beneficiaries
          </Link>
          <Link className="flex items-center gap-md px-lg py-md text-on-surface-variant dark:text-outline-variant hover:bg-surface-container dark:hover:bg-surface-container-high transition-all duration-200 ease-in-out font-label-md text-label-md group" to="/phc/households">
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">home_health</span>
            Households
          </Link>
          <Link className="flex items-center gap-md px-lg py-md text-on-surface-variant dark:text-outline-variant hover:bg-surface-container dark:hover:bg-surface-container-high transition-all duration-200 ease-in-out font-label-md text-label-md group" to="/phc/maternal">
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">pregnant_woman</span>
            Maternal Health
          </Link>
          <Link className="flex items-center gap-md px-lg py-md text-on-surface-variant dark:text-outline-variant hover:bg-surface-container dark:hover:bg-surface-container-high transition-all duration-200 ease-in-out font-label-md text-label-md group" to="/phc/children">
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">child_care</span>
            Child Health
          </Link>
        </div>
        <div className="p-lg mt-auto">
          <div className="flex flex-col gap-sm border-t border-outline-variant pt-md">
            <a className="flex items-center gap-md py-sm text-on-surface-variant dark:text-outline-variant hover:text-primary transition-colors font-label-md text-label-md" href="#">
              <span className="material-symbols-outlined text-[20px]">settings</span>
              Settings
            </a>
          </div>
        </div>
      </nav>
      <div className="flex-1 flex flex-col ml-0 md:ml-64 min-h-screen">
        <header className="bg-surface-container-lowest dark:bg-inverse-surface w-full top-0 sticky shadow-sm z-40 flex justify-between items-center px-lg py-sm w-full">
          <div className="flex items-center gap-md w-full max-w-2xl">
            <button className="md:hidden p-sm rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed md:hidden">PHC Admin Portal</div>
            <div className="hidden md:flex relative w-full max-w-lg items-center">
              <span className="material-symbols-outlined absolute left-sm text-outline">search</span>
              <input
                className="w-full bg-surface pl-[40px] pr-md py-[10px] rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-body-md font-body-md text-on-surface placeholder:text-outline transition-all h-[40px]"
                placeholder="Search beneficiaries, households, or ID..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyFilters()
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-sm">
            <button aria-label="sync" className="p-sm rounded-full text-on-surface-variant dark:text-outline-variant hover:bg-surface-container dark:hover:bg-surface-variant transition-colors cursor-pointer active:opacity-80 flex items-center justify-center w-10 h-10 relative">
              <span className="material-symbols-outlined text-[24px]">sync</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-secondary rounded-full animate-pulse"></span>
            </button>
            <button aria-label="notifications" className="p-sm rounded-full text-on-surface-variant dark:text-outline-variant hover:bg-surface-container dark:hover:bg-surface-variant transition-colors cursor-pointer active:opacity-80 flex items-center justify-center w-10 h-10 relative">
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              <span className="absolute top-1 right-1 w-[18px] h-[18px] bg-error text-on-error rounded-full text-[10px] flex items-center justify-center font-bold">3</span>
            </button>
          </div>
        </header>
        <main className="flex-1 p-lg md:p-xl flex flex-col md:flex-row gap-lg overflow-hidden h-[calc(100vh-64px)]">
          <aside className="w-full md:w-72 bg-surface-container-lowest rounded-xl border border-outline-variant flex flex-col overflow-hidden shrink-0 h-full shadow-sm">
            <div className="p-md border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
              <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-sm">
                <span className="material-symbols-outlined text-primary">filter_list</span>
                Filters
              </h2>
              <button onClick={resetFilters} className="text-primary font-label-md text-label-md hover:underline">Reset</button>
            </div>
            <div className="flex-1 overflow-y-auto p-md flex flex-col gap-form-gap">
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface">Village</label>
                <div className="relative">
                  <select className="w-full bg-surface border border-outline-variant rounded-lg px-md py-sm appearance-none focus:border-primary focus:ring-1 focus:ring-primary text-body-md font-body-md h-[40px]" value={village} onChange={(e) => setVillage(e.target.value)}>
                    <option value="">All Villages</option>
                    {VILLAGES.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-sm top-1/2 -translate-y-1/2 text-outline pointer-events-none">expand_more</span>
                </div>
              </div>
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface">Category</label>
                <div className="relative">
                  <select className="w-full bg-surface border border-outline-variant rounded-lg px-md py-sm appearance-none focus:border-primary focus:ring-1 focus:ring-primary text-body-md font-body-md h-[40px]" value={category} onChange={(e) => setCategory(e.target.value as 'all' | BeneficiaryStatus)}>
                    <option value="all">All Categories</option>
                    <option value="pregnant">ANC (Pregnant)</option>
                    <option value="postnatal">PNC (Postnatal)</option>
                    <option value="child">Child</option>
                    <option value="eligible">Eligible</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-sm top-1/2 -translate-y-1/2 text-outline pointer-events-none">expand_more</span>
                </div>
              </div>
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface">Name / ABHA / Phone</label>
                <input
                  className="w-full bg-surface border border-outline-variant rounded-lg px-md py-sm focus:border-primary focus:ring-1 focus:ring-primary text-body-md font-body-md h-[40px] text-on-surface"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyFilters()
                  }}
                />
              </div>
            </div>
            <div className="p-md border-t border-outline-variant bg-surface-container-lowest">
              <button onClick={applyFilters} className="w-full bg-primary-container text-on-primary font-label-md text-label-md py-[10px] rounded-lg shadow-sm hover:opacity-90 transition-opacity">
                Apply Filters
              </button>
            </div>
          </aside>
          <div className="flex-1 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm flex flex-col overflow-hidden min-w-0">
            <div className="p-md border-b border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md bg-surface-container-lowest">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">Beneficiary Directory</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">Showing {rows.length} of {total} records matching filters</p>
              </div>
              <div className="flex items-center gap-sm w-full sm:w-auto">
                <button onClick={exportCsv} className="flex items-center gap-sm px-md py-[8px] border border-outline-variant rounded-lg text-on-surface hover:bg-surface-container transition-colors font-label-md text-label-md whitespace-nowrap">
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Export CSV
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-surface-container-lowest relative">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low sticky top-0 z-10 border-b border-outline-variant">
                  <tr>
                    <th className="py-sm px-md font-label-md text-label-md text-on-surface-variant w-12 text-center">
                      <input
                        className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                        type="checkbox"
                        checked={rows.length > 0 && selected.size === rows.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelected(new Set(rows.map((r) => r.id)))
                          else setSelected(new Set())
                        }}
                      />
                    </th>
                    <th className="py-sm px-md font-label-md text-label-md text-on-surface-variant whitespace-nowrap">Patient Name / ID</th>
                    <th className="py-sm px-md font-label-md text-label-md text-on-surface-variant whitespace-nowrap">Village</th>
                    <th className="py-sm px-md font-label-md text-label-md text-on-surface-variant whitespace-nowrap">Category</th>
                    <th className="py-sm px-md font-label-md text-label-md text-on-surface-variant whitespace-nowrap">Status</th>
                    <th className="py-sm px-md font-label-md text-label-md text-on-surface-variant text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="font-body-md text-body-md text-on-surface divide-y divide-surface-container">
                  {loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-on-surface-variant">Loading beneficiaries...</td>
                    </tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-on-surface-variant">No beneficiaries match your filters.</td>
                    </tr>
                  )}
                  {rows.map((b) => {
                    const st = statusOf(b)
                    return (
                      <tr key={b.id} className={`hover:bg-surface-bright transition-colors group h-[48px] ${b.isPregnant ? 'border-l-4 border-error' : 'border-l-4 border-secondary'}`}>
                        <td className="py-sm px-md text-center">
                          <input
                            className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                            type="checkbox"
                            checked={selected.has(b.id)}
                            onChange={() => toggleRow(b.id)}
                          />
                        </td>
                        <td className="py-sm px-md">
                          <Link to={`/phc/beneficiaries/${b.id}`} className="hover:opacity-80">
                            <div className="font-label-md text-label-md text-on-surface">{b.name}</div>
                            <div className="font-caption text-caption text-on-surface-variant">ID: {b.abhaId ?? b.id.toUpperCase()}</div>
                          </Link>
                        </td>
                        <td className="py-sm px-md">{b.village}</td>
                        <td className="py-sm px-md">{categoryOf(b)}</td>
                        <td className="py-sm px-md">
                          <div className={st.tone}>{st.label}</div>
                        </td>
                        <td className="py-sm px-md text-right">
                          <Link to={`/phc/beneficiaries/${b.id}`} className="text-primary hover:bg-surface-container p-xs rounded transition-colors material-symbols-outlined text-[20px]" title="View Record">
                            visibility
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-sm border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between">
              <div className="font-caption text-caption text-on-surface-variant px-sm">
                Page {page} of {Math.max(1, totalPages)} · {total} total
              </div>
              <div className="flex items-center gap-xs">
                <button className="p-xs text-outline hover:bg-surface-container rounded transition-colors" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <button className="p-xs text-on-surface hover:bg-surface-container rounded transition-colors" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
