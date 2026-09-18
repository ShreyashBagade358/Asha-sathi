import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { useQuery } from '@tanstack/react-query'
import { pregnancyService } from '@/services/pregnancy.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'

function initials(name: string) {
  return (name || '?').charAt(0)
}

function formatEDD(edd: string) {
  if (!edd) return '—'
  const d = new Date(edd)
  if (Number.isNaN(d.getTime())) return edd
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function trimesterFromLmp(lmp: string): number {
  if (!lmp) return 0
  const start = new Date(lmp).getTime()
  if (Number.isNaN(start)) return 0
  const weeks = Math.max(0, Math.floor((Date.now() - start) / (7 * 86400000)))
  if (weeks <= 13) return 1
  if (weeks <= 26) return 2
  return 3
}

export default function MaternalHealthPhcAdmin() {
  const { data: pregData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pregnancies', 'maternal'],
    queryFn: () => pregnancyService.listPregnancies({ page: 1, pageSize: 1000 }),
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

  const pregnancies = (pregData?.items ?? []).map((p) => {
    const ben = beneficiaryMap.get(p.beneficiaryId)
    return {
      ...p,
      patientName: ben?.name ?? '—',
      village: ben?.village ?? '—',
      trimester: trimesterFromLmp(p.lmp),
      risk: p.hrpLevel ?? 'low',
      riskReason: p.complications[0] ?? 'High risk',
    }
  })

  const highRisk = pregnancies.filter((p) => p.risk === 'high' || p.risk === 'medium')
  const villages = Array.from(new Set(pregnancies.map((p) => p.village).filter((v) => v && v !== '—')))

  const total = pregnancies.length
  const high = pregnancies.filter((p) => p.risk === 'high').length
  const deliveryRate = total > 0 ? Math.round(((total - high) / total) * 100) : 0
  const anc4Pct = 0
  const counts = { total, high, deliveryRate, anc4Pct }

  const ashaFor = () => 'ASHA'

  const byVillage = villages.map((v) => {
    const vPregs = pregnancies.filter((p) => p.village === v)
    const vHigh = vPregs.filter((p) => p.risk !== 'low').length
    return { village: v, total: vPregs.length, high: vHigh, normal: vPregs.length - vHigh }
  })

  const ancMonths: string[] = []

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
          <div className="p-6"><LoadingState label="Loading maternal health data…" /></div>
        </main>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
          <div className="p-6"><ErrorState message={getErrorMessage(error)} onRetry={refetch} /></div>
        </main>
      </div>
    )
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
                <span className="material-symbols-outlined text-tertiary text-[20px]">pregnant_woman</span>
                Maternal Health Overview
              </h2>
              <p className="text-caption text-on-surface-variant">PHC Dashboard · Live data</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant text-label-md text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
              <span>Synced</span>
            </div>
            <Link to="/phc/maternal/pregnant" className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full font-label-md text-label-md font-semibold shadow-sm hover:bg-on-primary-fixed-variant transition-colors">
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span className="hidden sm:inline">Register</span>
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Total Pregnancies</span>
                <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">pregnant_woman</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{counts.total}</div>
              <div className="text-caption text-on-surface-variant mt-1">Across {villages.length} villages</div>
            </div>

            <div className="bg-surface-container-lowest border-l-4 border-l-primary border border-outline-variant rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-error-container/20 rounded-full blur-xl"></div>
              <div className="flex justify-between items-start mb-3 relative z-10">
                <span className="text-xs text-on-surface-variant font-medium">High-Risk Cases</span>
                <div className="bg-error-container text-on-error-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                </div>
              </div>
              <div className="text-display-lg font-display-lg text-error relative z-10">{counts.high}</div>
              <div className="text-caption text-error mt-1 relative z-10">Needs priority care</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Institutional Delivery</span>
                <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">local_hospital</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{counts.deliveryRate}%</div>
              <div className="text-caption text-secondary mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> Non-high-risk share
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs text-on-surface-variant font-medium">ANC-4 Coverage</span>
                <div className="bg-surface-variant text-on-surface p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">medical_information</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">—</div>
              <div className="text-caption text-on-surface-variant mt-1">Not available</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-headline-sm text-on-surface font-semibold">ANC Visit Compliance</h3>
                  <p className="text-caption text-on-surface-variant">Monthly data not available</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-primary"></div>
                    <span className="text-caption text-on-surface-variant">ANC 1</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-primary-fixed-dim"></div>
                    <span className="text-caption text-on-surface-variant">ANC 2+</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-[220px] flex items-center justify-center text-body-md text-on-surface-variant">
                {ancMonths.length === 0 ? 'No visit trend data available' : ''}
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col">
              <h3 className="text-headline-sm text-on-surface font-semibold mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">child_care</span>
                Expected Deliveries
              </h3>
              <p className="text-caption text-on-surface-variant mb-4">All registered pregnancies</p>

              <div className="flex items-center justify-center mb-4 relative h-36">
                <div className="w-28 h-28 rounded-full border-8 border-surface-variant relative">
                  <div className="absolute inset-0 rounded-full border-8 border-primary border-t-transparent border-r-transparent -rotate-45"></div>
                  <div className="absolute inset-0 rounded-full border-8 border-tertiary-container border-b-transparent border-l-transparent rotate-12"></div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container-lowest rounded-full m-1.5">
                    <span className="text-headline-md text-on-surface font-headline-md">{counts.total}</span>
                    <span className="text-caption text-on-surface-variant">Total</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center p-2.5 bg-surface rounded-lg border border-outline-variant">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    <span className="text-label-md text-on-surface">Normal Risk</span>
                  </div>
                  <span className="text-headline-sm text-on-surface font-headline-sm">{counts.total - counts.high > 0 ? counts.total - counts.high : '—'}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-error-container/20 rounded-lg border border-error/20">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-error"></div>
                    <span className="text-label-md text-error">High Risk</span>
                  </div>
                  <span className="text-headline-sm text-error font-headline-sm">{counts.high > 0 ? counts.high : '—'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-error" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
                <h3 className="text-headline-sm text-on-surface font-semibold">Critical Attention Required</h3>
              </div>
              <span className="text-label-md text-error font-medium">{highRisk.length} cases</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-4 py-3 text-label-md text-on-surface-variant font-medium">Patient</th>
                    <th className="p-3 text-label-md text-on-surface-variant font-medium">EDD</th>
                    <th className="px-4 py-3 text-label-md text-on-surface-variant font-medium">Risk Factors</th>
                    <th className="p-3 text-label-md text-on-surface-variant font-medium">ASHA Worker</th>
                    <th className="p-3 text-label-md text-on-surface-variant font-medium text-right px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {highRisk.map((p, idx) => (
                    <tr key={p.id} className={`hover:bg-surface-container-low transition-colors h-14 ${idx % 2 === 0 ? 'bg-surface' : 'bg-surface-container-low'}`}>
                      <td className="px-4 py-3">
                        <Link to={`/phc/maternal/${p.id}`} className="flex items-center gap-3 group">
                          <div className="w-9 h-9 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center text-label-md font-bold shrink-0">
                            {initials(p.patientName)}
                          </div>
                          <div>
                            <div className="text-body-md text-on-surface font-medium group-hover:text-primary transition-colors">{p.patientName}</div>
                            <div className="text-caption text-on-surface-variant">{p.village}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="p-3 text-body-md text-on-surface-variant">{formatEDD(p.edd)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-caption font-semibold">
                            {p.riskReason}
                          </span>
                          {p.trimester > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-caption font-semibold">
                              T{p.trimester}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-body-md text-on-surface-variant">{ashaFor()}</td>
                      <td className="p-3 text-right px-4">
                        <button className="bg-error text-on-error font-label-md text-label-md px-4 py-1.5 rounded-full shadow-sm hover:bg-on-error-fixed-variant transition-colors font-medium">
                          Intervene
                        </button>
                      </td>
                    </tr>
                  ))}
                  {highRisk.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center">
                        <span className="material-symbols-outlined text-[48px] text-outline mb-3 block">check_circle</span>
                        <p className="text-body-lg text-on-surface-variant">No critical cases. All pregnancies on track.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-headline-sm text-on-surface font-semibold">Village Breakdown</h3>
            </div>
            {byVillage.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">No village data available.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {byVillage.map((v) => (
                  <div key={v.village} className="p-4 bg-surface rounded-xl border border-outline-variant">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-label-md text-on-surface font-medium">{v.village}</span>
                      <span className="text-caption text-on-surface-variant">{v.total} pregnancies</span>
                    </div>
                    <div className="w-full bg-surface-variant h-2.5 rounded-full overflow-hidden flex">
                      <div className="bg-primary h-full rounded-l-full" style={{ width: `${v.total > 0 ? (v.normal / v.total) * 100 : 0}%` }}></div>
                      <div className="bg-error h-full rounded-r-full" style={{ width: `${v.total > 0 ? (v.high / v.total) * 100 : 0}%` }}></div>
                    </div>
                    <div className="flex justify-between mt-2 text-caption text-on-surface-variant">
                      <span>{v.normal} normal</span>
                      <span>{v.high} high-risk</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
