import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ashaService, type ASHAUser, type ASHAStatus } from '@/services/asha.service'

const VILLAGES = ['Rampur', 'Sonpur', 'Kandwa', 'Tikari', 'Basari']

function statusChip(status: ASHAStatus) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-xs px-2 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-[12px]">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Active
      </span>
    )
  }
  if (status === 'on_leave') {
    return (
      <span className="inline-flex items-center gap-xs px-2 py-1 rounded-full bg-tertiary-container text-on-tertiary-container font-label-md text-[12px]">
        <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> On Leave
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-xs px-2 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-md text-[12px]">
      <span className="w-1.5 h-1.5 rounded-full bg-outline"></span> Inactive
    </span>
  )
}

export default function AshaWorkerDirectoryPhcAdmin() {
  const [workers, setWorkers] = useState<ASHAUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [village, setVillage] = useState('')
  const [status, setStatus] = useState<'all' | ASHAStatus>('all')
  const [loading, setLoading] = useState(false)

  const load = async (p: number, q: string, v: string, s: 'all' | ASHAStatus) => {
    setLoading(true)
    try {
      const res = await ashaService.listASHAs({
        search: q || undefined,
        village: v || undefined,
        status: s,
        page: p,
        pageSize: 8,
      })
      setWorkers(res.items)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(page, search, village, status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const applyFilters = () => {
    setPage(1)
    load(1, search, village, status)
  }

  const resetFilters = () => {
    setSearch('')
    setVillage('')
    setStatus('all')
    setPage(1)
    load(1, '', '', 'all')
  }

  const initials = (name: string) =>
    name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  return (
    <>
      <nav className="hidden md:flex flex-col h-screen fixed left-0 top-0 p-md gap-sm bg-surface-container-low border-r border-outline-variant docked left-0 h-full w-64 z-40">
        <div className="flex items-center gap-sm mb-lg px-xs py-sm border-b border-outline-variant pb-md">
          <img alt="Admin Avatar" className="w-10 h-10 rounded-full object-cover shadow-sm" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCRKXqR9LRQ2Xo8p9w3RVnKUgJfcgY86RZv4gWsCQtXizSkDdQCgg2V6d2r5mlskoDL_xg_dyZDAN0rkthe2IxZkGvILq2Yq09B0vsovVd0VSOR0fLMJ7BaSjhAJoF1XPKdJp068tJpvYhJaMx6UnLDDs7zZhJ6TItzjBeEBZyKUhJnm8ZyHrYlULnzuxub-LWpc8tvUyV3mkm9Ij8cD1Jb9mJ4KmALpmYEAqRezryHI9EwocG9C_g_QA" />
          <div className="flex flex-col">
            <span className="font-headline-md text-headline-md font-black text-primary">Admin Portal</span>
            <span className="font-caption text-caption text-on-surface-variant">District Health Office</span>
          </div>
        </div>
        <div className="flex flex-col gap-xs flex-1">
          <Link className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:bg-surface-container-highest transition-all font-label-md text-label-md group" to="/phc/dashboard">
            <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">dashboard</span>
            Dashboard
          </Link>
          <Link className="flex items-center gap-md px-md py-sm rounded-lg bg-secondary-container text-on-secondary-container font-bold rounded-lg transition-transform duration-150 font-label-md text-label-md opacity-100" to="/phc/ashas">
            <span className="material-symbols-outlined filled">groups</span>
            Workers
          </Link>
          <Link className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:bg-surface-container-highest transition-all font-label-md text-label-md group" to="/phc/beneficiaries">
            <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">person_celebrate</span>
            Beneficiaries
          </Link>
          <Link className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:bg-surface-container-highest transition-all font-label-md text-label-md group" to="/phc/reports/maternal">
            <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">analytics</span>
            Reports
          </Link>
          <Link className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:bg-surface-container-highest transition-all font-label-md text-label-md group" to="/phc/vaccination">
            <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">inventory_2</span>
            Inventory
          </Link>
        </div>
        <Link to="/phc/ashas/new" className="w-full bg-primary-container text-on-primary-container font-label-md text-label-md py-md rounded-xl flex items-center justify-center gap-sm hover:opacity-90 transition-opacity mt-md shadow-sm">
          <span className="material-symbols-outlined">add</span>
          Add New Worker
        </Link>
        <div className="flex flex-col gap-xs mt-md pt-md border-t border-outline-variant">
          <a className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:bg-surface-container-highest transition-all font-label-md text-label-md group" href="#">
            <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">settings</span>
            Settings
          </a>
          <a className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:bg-surface-container-highest transition-all font-label-md text-label-md group" href="#">
            <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">help</span>
            Support
          </a>
        </div>
      </nav>
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen bg-background">
        <header className="bg-surface border-b border-outline-variant shadow-sm flex justify-between items-center px-md h-touch-target md:px-lg sticky top-0 z-30">
          <div className="md:hidden flex items-center gap-sm">
            <span className="text-headline-md font-headline-md font-bold text-primary">ASHA Sathi</span>
          </div>
          <div className="flex-1 flex justify-end items-center gap-md w-full ml-auto md:w-auto">
            <div className="hidden lg:flex items-center gap-xs px-sm py-xs rounded-full bg-surface-container-low border border-outline-variant mr-sm">
              <span className="material-symbols-outlined text-secondary text-[16px]">check_circle</span>
              <span className="font-caption text-caption text-on-surface-variant">District Sync: 2 mins ago</span>
            </div>
            <div className="relative w-full max-w-xs hidden sm:block">
              <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline">search</span>
              <input
                className="w-full pl-xl pr-md py-sm rounded-full bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-md font-body-md text-on-surface placeholder:text-on-surface-variant/70 h-10 transition-all"
                placeholder="Search workers, villages..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyFilters()
                }}
              />
            </div>
            <div className="flex items-center gap-sm">
              <button aria-label="Sync Data" className="p-xs rounded-full text-on-surface-variant hover:bg-surface-container transition-colors relative">
                <span className="material-symbols-outlined">sync</span>
              </button>
              <button aria-label="Notifications" className="p-xs rounded-full text-on-surface-variant hover:bg-surface-container transition-colors relative">
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 p-md md:p-lg overflow-y-auto w-full max-w-[1440px] mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md mb-lg">
            <div>
              <h1 className="font-display-lg text-display-lg text-on-surface m-0">ASHA Workers</h1>
              <p className="font-body-md text-body-md text-on-surface-variant mt-xs">Total Workers: <span className="font-bold text-on-surface">{total}</span></p>
            </div>
            <Link to="/phc/ashas/new" className="bg-primary text-on-primary hover:bg-on-primary-fixed-variant transition-colors py-sm px-md rounded-full font-label-md text-label-md flex items-center gap-xs shadow-sm whitespace-nowrap h-touch-target">
              <span className="material-symbols-outlined">add</span>
              Add New Worker
            </Link>
          </div>
          <div className="bg-surface rounded-xl border border-outline-variant p-md mb-lg shadow-sm flex flex-col lg:flex-row gap-md items-start lg:items-end">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-md flex-1 w-full">
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface-variant">Village</label>
                <div className="relative">
                  <select className="w-full appearance-none bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm pr-xl h-10 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:border-primary" value={village} onChange={(e) => setVillage(e.target.value)}>
                    <option value="">All Villages</option>
                    {VILLAGES.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-sm top-1/2 -translate-y-1/2 text-outline pointer-events-none">arrow_drop_down</span>
                </div>
              </div>
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-label-md text-on-surface-variant">Status</label>
                <div className="relative">
                  <select className="w-full appearance-none bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm pr-xl h-10 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:border-primary" value={status} onChange={(e) => setStatus(e.target.value as 'all' | ASHAStatus)}>
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-sm top-1/2 -translate-y-1/2 text-outline pointer-events-none">arrow_drop_down</span>
                </div>
              </div>
              <div className="flex items-end">
                <input
                  className="w-full h-10 bg-surface-container-low border border-outline-variant rounded-lg px-md font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary"
                  placeholder="Search by name, ID, phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyFilters()
                  }}
                />
              </div>
            </div>
            <div className="flex gap-sm w-full lg:w-auto mt-sm lg:mt-0">
              <button onClick={resetFilters} className="px-md py-sm h-10 border border-outline-variant text-on-surface-variant font-label-md text-label-md rounded-lg hover:bg-surface-container-low transition-colors flex-1 lg:flex-none flex items-center justify-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                Reset
              </button>
              <button onClick={applyFilters} className="px-md py-sm h-10 bg-surface-tint text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary transition-colors flex-1 lg:flex-none shadow-sm">
                Apply Filters
              </button>
            </div>
          </div>
          <div className="bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col mb-lg">
            <div className="overflow-x-auto table-container">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="py-sm px-md font-label-md text-label-md text-on-surface-variant whitespace-nowrap">Worker Name</th>
                    <th className="py-sm px-md font-label-md text-label-md text-on-surface-variant whitespace-nowrap">Mobile Number</th>
                    <th className="py-sm px-md font-label-md text-label-md text-on-surface-variant whitespace-nowrap">Village</th>
                    <th className="py-sm px-md font-label-md text-label-md text-on-surface-variant text-right whitespace-nowrap">Households</th>
                    <th className="py-sm px-md font-label-md text-label-md text-on-surface-variant text-right whitespace-nowrap">Performance</th>
                    <th className="py-sm px-md font-label-md text-label-md text-on-surface-variant text-center whitespace-nowrap">Status</th>
                    <th className="py-sm px-md font-label-md text-label-md text-on-surface-variant text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="font-body-md text-body-md text-on-surface">
                  {loading && workers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-on-surface-variant">Loading workers...</td>
                    </tr>
                  )}
                  {!loading && workers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-on-surface-variant">No workers match your filters.</td>
                    </tr>
                  )}
                  {workers.map((w) => (
                    <tr key={w.id} className="border-b border-outline-variant/50 hover:bg-surface-container-lowest transition-colors h-[56px]">
                      <td className="py-sm px-md">
                        <Link to={`/phc/ashas/${w.ashaId}`} className="flex items-center gap-sm hover:opacity-80">
                          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm">{initials(w.name)}</div>
                          <span className="font-label-md font-bold text-on-surface">{w.name}</span>
                        </Link>
                      </td>
                      <td className="py-sm px-md text-on-surface-variant font-mono text-sm">+91 {w.phone.replace(/(\d{5})(\d{5})/, '$1 $2')}</td>
                      <td className="py-sm px-md">{w.village}</td>
                      <td className="py-sm px-md text-right">{w.assignedHouseholds}</td>
                      <td className="py-sm px-md text-right">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full font-label-md text-[12px] ${w.performanceScore >= 75 ? 'bg-secondary-container text-on-secondary-container' : w.performanceScore >= 60 ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-error-container text-on-error-container'}`}>
                          {w.performanceScore}
                        </span>
                      </td>
                      <td className="py-sm px-md text-center">{statusChip(w.status)}</td>
                      <td className="py-sm px-md text-center">
                        <div className="flex items-center justify-center gap-sm">
                          <Link to={`/phc/ashas/${w.ashaId}`} className="text-primary hover:text-surface-tint p-1 rounded hover:bg-surface-container-low transition-colors" title="View Profile">
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-outline-variant bg-surface-container-lowest p-sm px-md flex items-center justify-between">
              <span className="font-caption text-caption text-on-surface-variant hidden sm:inline-block">
                Showing {workers.length} of {total} workers
              </span>
              <div className="flex items-center gap-xs ml-auto sm:ml-0">
                <button className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container disabled:opacity-50 transition-colors" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <span className="font-label-md text-label-md text-on-surface-variant px-2">
                  Page {page} of {Math.max(1, totalPages)}
                </span>
                <button className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container disabled:opacity-50 transition-colors" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-sm py-xs bg-surface border-t border-outline-variant shadow-lg docked full-width bottom-0 rounded-t-full pb-safe">
        <Link className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-highest p-2 rounded-xl transition-colors min-w-[64px] min-h-[48px]" to="/phc/dashboard">
          <span className="material-symbols-outlined mb-1">home</span>
          <span className="font-label-md text-[11px] leading-tight text-center">Home</span>
        </Link>
        <Link className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-highest p-2 rounded-xl transition-colors min-w-[64px] min-h-[48px]" to="/phc/households">
          <span className="material-symbols-outlined mb-1">cottage</span>
          <span className="font-label-md text-[11px] leading-tight text-center">Households</span>
        </Link>
        <Link className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-4 py-1 transition-transform duration-200 scale-90 min-w-[64px] min-h-[48px]" to="/phc/beneficiaries">
          <span className="material-symbols-outlined filled mb-1">person_search</span>
          <span className="font-label-md text-[11px] leading-tight text-center font-bold">Patients</span>
        </Link>
        <Link className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-highest p-2 rounded-xl transition-colors min-w-[64px] min-h-[48px]" to="/phc/alerts">
          <span className="material-symbols-outlined mb-1">assignment_turned_in</span>
          <span className="font-label-md text-[11px] leading-tight text-center">Tasks</span>
        </Link>
        <Link className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-highest p-2 rounded-xl transition-colors min-w-[64px] min-h-[48px]" to="/phc/dashboard">
          <span className="material-symbols-outlined mb-1">account_circle</span>
          <span className="font-label-md text-[11px] leading-tight text-center">Profile</span>
        </Link>
      </nav>
    </>
  )
}
