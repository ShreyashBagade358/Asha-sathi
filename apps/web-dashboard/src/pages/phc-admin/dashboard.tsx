import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { dashboardService } from '@/services/dashboard.service'
import { ashaService } from '@/services/asha.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { pregnancyService } from '@/services/pregnancy.service'
import { vaccinationService } from '@/services/vaccination.service'
import { referralService } from '@/services/referral.service'
import { ecService } from '@/services/ec.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

export default function PhcAdminDashboard() {
  const kpis = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => dashboardService.getKPIs(),
  })
  const ashas = useQuery({
    queryKey: ['ashas', 'all'],
    queryFn: () => ashaService.listASHAs({ pageSize: 1000 }),
  })
  const beneficiaries = useQuery({
    queryKey: ['beneficiaries', 'all'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })
  const pregnancies = useQuery({
    queryKey: ['pregnancies', 'all'],
    queryFn: () => pregnancyService.listPregnancies({ pageSize: 1000 }),
  })
  const coverage = useQuery({
    queryKey: ['vaccination', 'coverage'],
    queryFn: () => vaccinationService.getCoverage(),
  })
  const referrals = useQuery({
    queryKey: ['referrals', 'all'],
    queryFn: () => referralService.listReferrals({ pageSize: 1000 }),
  })
  const ecs = useQuery({
    queryKey: ['eligible-couples', 'all'],
    queryFn: () => ecService.listEligibleCouples({ pageSize: 1000 }),
  })

  const allLoading = kpis.isLoading || ashas.isLoading || beneficiaries.isLoading || pregnancies.isLoading || coverage.isLoading || referrals.isLoading || ecs.isLoading
  const firstError = kpis.error ?? ashas.error ?? beneficiaries.error ?? pregnancies.error ?? coverage.error ?? referrals.error ?? ecs.error
  const refetchAll = () => {
    kpis.refetch()
    ashas.refetch()
    beneficiaries.refetch()
    pregnancies.refetch()
    coverage.refetch()
    referrals.refetch()
    ecs.refetch()
  }

  const kpiData = kpis.data
  const ashaItems = ashas.data?.items ?? []
  const benItems = beneficiaries.data?.items ?? []
  const pregItems = pregnancies.data?.items ?? []
  const cover = coverage.data
  const refItems = referrals.data?.items ?? []
  const ecItems = ecs.data?.items ?? []

  const ashaCount = ashaItems.length
  const activeAsha = ashaItems.filter((w) => w.status === 'active').length

  const benMap = useMemo(() => new Map(benItems.map((b) => [b.id, b])), [benItems])
  const villageCount = useMemo(() => new Set(benItems.map((p) => p.village).filter(Boolean)).size, [benItems])

  const highRiskPregnancies = pregItems.filter((p) => p.hrpLevel === 'high').length
  const mediumRiskPregnancies = pregItems.filter((p) => p.hrpLevel === 'medium').length
  const normalPregnancies = pregItems.filter((p) => p.hrpLevel === undefined && !p.highRisk).length
  const activePregnancies = kpiData?.activePregnancies ?? pregItems.filter((p) => p.status === 'active').length

  const pendingReferrals = refItems.filter((r) => r.status === 'pending').length
  const urgentReferrals = refItems.filter((r) => r.status === 'pending' && (r.urgency === 'urgent' || r.urgency === 'emergency')).length

  const followUpsDue = ecItems.filter((ec) => ec.nextFollowupDate).length
  const today = new Date()
  const overdueFollowUps = ecItems.filter((ec) => ec.nextFollowupDate && new Date(ec.nextFollowupDate) < today).length

  const coveragePct = cover?.coveragePct ?? 0
  const vaccinationGiven = cover?.given ?? 0
  const vaccinationPending = cover?.due ?? 0

  const counts = {
    ashaCount, activeAsha, villageCount, beneficiaryCount: kpiData?.beneficiaryCount ?? benItems.length,
    highRiskPregnancies, mediumRiskPregnancies, normalPregnancies, activePregnancies,
    pendingReferrals, urgentReferrals, followUpsDue, overdueFollowUps,
    coveragePct, vaccinationGiven, vaccinationPending,
  }

  const alerts = useMemo(
    () =>
      pregItems
        .filter((p) => p.hrpLevel === 'high' || p.hrpLevel === 'medium')
        .map((p) => {
          const ben = benMap.get(p.beneficiaryId)
          const village = ben?.village ?? ''
          const asha = ashaItems.find((w) => w.village === village)
          return {
            id: p.id,
            beneficiaryId: p.beneficiaryId,
            beneficiaryName: ben?.name ?? 'Beneficiary',
            village,
            ashaName: asha?.name ?? 'ASHA',
            hrpLevel: (p.hrpLevel ?? 'medium') as 'high' | 'medium',
            reason: p.complications.length ? p.complications.join(', ') : 'High risk pregnancy',
          }
        })
        .slice(0, 3),
    [pregItems, benMap, ashaItems],
  )

  const villageBreakdown = useMemo(() => {
    const villages = Array.from(new Set(benItems.map((p) => p.village).filter(Boolean)))
    return villages.map((v) => {
      const vPatients = benItems.filter((p) => p.village === v)
      const vPregs = pregItems.filter((p) => benMap.get(p.beneficiaryId)?.village === v)
      const vHighRisk = vPregs.filter((p) => p.hrpLevel === 'high' || p.hrpLevel === 'medium').length
      const vAsha = ashaItems.find((w) => w.village === v)
      return { village: v, patients: vPatients.length, pregnancies: vPregs.length, highRisk: vHighRisk, asha: vAsha?.name ?? '—' }
    })
  }, [benItems, pregItems, benMap, ashaItems])

  const byVaccine = cover?.byVaccine ?? []
  const maxVaccineGiven = Math.max(1, ...byVaccine.map((v) => v.given))

  if (allLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto">
          <LoadingState label="Loading dashboard…" />
        </main>
      </div>
    )
  }

  if (firstError) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto">
          <ErrorState message={getErrorMessage(firstError)} onRetry={refetchAll} />
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 text-on-surface-variant">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <h2 className="text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">dashboard</span>
                PHC Dashboard
              </h2>
              <p className="text-caption text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>fiber_manual_record</span>
                Live Monitoring
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant text-label-md text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>database</span>
              <span>Live Data</span>
            </div>
            <Link to="/phc/notifications" className="relative p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
              <span className="material-symbols-outlined">notifications</span>
              {(counts.urgentReferrals + counts.overdueFollowUps) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-error text-on-error text-[10px] font-bold px-1">
                  {counts.urgentReferrals + counts.overdueFollowUps}
                </span>
              )}
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24 md:pb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <Link to="/phc/ashas" className="bg-surface-container-lowest py-3 px-5 rounded-lg border border-outline-variant flex items-center gap-3 hover:shadow-md transition-shadow group h-28">
              <div className="p-2.5 bg-primary-container text-on-primary-container rounded-lg group-hover:bg-primary group-hover:text-on-primary transition-colors">
                <span className="material-symbols-outlined text-[24px]">groups</span>
              </div>
              <div>
                <p className="text-caption text-on-surface-variant font-medium">ASHA Workers</p>
                <h3 className="text-headline-md text-on-surface font-bold">{counts.ashaCount}</h3>
                <p className="text-[11px] text-secondary font-medium">{counts.activeAsha} active</p>
              </div>
            </Link>
            <Link to="/phc/beneficiaries" className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant flex items-center gap-3 hover:shadow-md transition-shadow group h-32">
              <div className="p-2.5 bg-tertiary-container text-on-tertiary-container rounded-lg group-hover:bg-tertiary group-hover:text-on-tertiary transition-colors">
                <span className="material-symbols-outlined text-[24px]">person_list</span>
              </div>
              <div>
                <p className="text-caption text-on-surface-variant font-medium">Beneficiaries</p>
                <h3 className="text-headline-md text-on-surface font-bold">{counts.beneficiaryCount.toLocaleString()}</h3>
                <p className="text-[11px] text-secondary font-medium">Across {counts.villageCount} villages</p>
              </div>
            </Link>
            <Link to="/phc/follow-ups" className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant flex items-center gap-3 hover:shadow-md transition-shadow group h-32">
              <div className="p-2.5 bg-secondary-container text-on-secondary-container rounded-lg group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                <span className="material-symbols-outlined text-[24px]">event_available</span>
              </div>
              <div>
                <p className="text-caption text-on-surface-variant font-medium">Follow-ups Due</p>
                <h3 className="text-headline-md text-on-surface font-bold">{counts.followUpsDue}</h3>
                {counts.overdueFollowUps > 0 && <p className="text-[11px] text-error font-medium">{counts.overdueFollowUps} overdue</p>}
              </div>
            </Link>
            <Link to="/phc/referrals" className="bg-surface-container-lowest py-3 px-5 rounded-lg border border-outline-variant flex items-center gap-3 hover:shadow-md transition-shadow group h-32">
              <div className="p-2.5 bg-error-container text-on-error-container rounded-lg group-hover:bg-error group-hover:text-on-error transition-colors">
                <span className="material-symbols-outlined text-[24px]">emergency</span>
              </div>
              <div>
                <p className="text-caption text-on-surface-variant font-medium">Pending Referrals</p>
                <h3 className="text-headline-md text-on-surface font-bold">{counts.pendingReferrals}</h3>
                {counts.urgentReferrals > 0 && <p className="text-[11px] text-error font-medium">{counts.urgentReferrals} urgent</p>}
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant">
              <div className="flex items-center justify-between mb-2">
                <span className="text-caption text-on-surface-variant font-medium">High Risk Pregnancies</span>
                <span className="material-symbols-outlined text-error text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              </div>
              <p className="text-headline-md text-error font-bold">{counts.highRiskPregnancies}</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">{counts.highRiskPregnancies} pregnancies</p>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant">
              <div className="flex items-center justify-between mb-2">
                <span className="text-caption text-on-surface-variant font-medium">Medium Risk</span>
                <span className="material-symbols-outlined text-tertiary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              </div>
              <p className="text-headline-md text-tertiary font-bold">{counts.mediumRiskPregnancies}</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">{counts.mediumRiskPregnancies} pregnancies</p>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant">
              <div className="flex items-center justify-between mb-2">
                <span className="text-caption text-on-surface-variant font-medium">Active Pregnancies</span>
                <span className="material-symbols-outlined text-tertiary-container text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>pregnant_woman</span>
              </div>
              <p className="text-headline-md text-on-surface font-bold">{counts.activePregnancies}</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">ANC coverage {kpiData?.anc4Coverage ?? 0}%</p>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant">
              <div className="flex items-center justify-between mb-2">
                <span className="text-caption text-on-surface-variant font-medium">Low Risk</span>
                <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <p className="text-headline-md text-secondary font-bold">{counts.normalPregnancies}</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">{counts.normalPregnancies} pregnancies</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
              <div className="px-5 py-3 border-b border-outline-variant flex justify-between items-center">
                <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>notification_important</span>
                  Critical Alerts
                </h2>
                <Link to="/phc/alerts" className="text-label-sm text-primary hover:underline">View All</Link>
              </div>
              <div className="p-4 space-y-3">
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <span className="material-symbols-outlined text-[40px] text-outline">check_circle</span>
                    <p className="text-body-md text-on-surface-variant">No critical alerts right now.</p>
                  </div>
                ) : (
                  alerts.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-error-container/20 border-l-2 border-l-error">
                      <span className="material-symbols-outlined text-error mt-0.5 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {a.hrpLevel === 'high' ? 'error' : 'warning'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-label-md font-semibold text-on-surface">{a.beneficiaryName}</h4>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${a.hrpLevel === 'high' ? 'bg-error text-on-error' : 'bg-tertiary-container text-on-tertiary-container'}`}>
                            {a.hrpLevel}
                          </span>
                        </div>
                        <p className="text-caption text-on-surface-variant mt-0.5">{a.reason} · {a.village || 'Village not set'} · {a.ashaName}</p>
                        <div className="mt-2 flex gap-2">
                          <Link to={`/phc/beneficiaries/${a.beneficiaryId}`} className="px-3 py-1 bg-error text-on-error text-[11px] font-bold rounded-lg hover:opacity-90 transition-opacity">View Record</Link>
                          <Link to="/phc/alerts" className="px-3 py-1 border border-outline-variant text-on-surface-variant text-[11px] font-bold rounded-lg hover:bg-surface-container transition-colors">Manage</Link>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
              <div className="px-5 py-3 border-b border-outline-variant">
                <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary-container text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>vaccines</span>
                  Immunization
                </h2>
              </div>
              <div className="p-5 flex flex-col items-center">
                <div className="relative size-36 mb-4">
                  <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                    <circle className="stroke-surface-container-high" cx="18" cy="18" fill="none" r="16" strokeWidth="3" />
                    <circle className="stroke-blue-500" cx="18" cy="18" fill="none" r="16" strokeDasharray={`${counts.coveragePct} ${100 - counts.coveragePct}`} strokeLinecap="round" strokeWidth="3" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-headline-md text-on-surface font-bold">{counts.coveragePct}%</span>
                    <span className="text-[10px] text-on-surface-variant">Coverage</span>
                  </div>
                </div>
                <div className="w-full space-y-2">
                  <div className="flex justify-between items-center text-caption">
                    <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-blue-500 inline-block" /> Doses Given</span>
                    <span className="font-semibold text-on-surface">{counts.vaccinationGiven.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-caption">
                    <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-surface-container-high inline-block" /> Due Now</span>
                    <span className="font-semibold text-on-surface">{counts.vaccinationPending.toLocaleString()}</span>
                  </div>
                </div>
                <Link to="/phc/vaccination" className="mt-4 w-full py-2 bg-surface-container hover:bg-surface-container-high rounded-lg text-label-sm text-primary font-bold text-center transition-colors">
                  View Report
                </Link>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-headline-sm text-on-surface">Coverage by Vaccine</h3>
                <span className="text-caption text-on-surface-variant">Doses administered</span>
              </div>
              {byVaccine.length === 0 ? (
                <EmptyState title="No vaccination data yet" description="Coverage will appear here once immunizations are recorded." icon="vaccines" />
              ) : (
                <div className="space-y-3">
                  {byVaccine.map((v) => (
                    <div key={v.vaccineCode} className="flex items-center gap-3">
                      <span className="text-[11px] font-semibold text-on-surface-variant w-16 shrink-0">{v.vaccineCode}</span>
                      <div className="flex-1 h-3 rounded-full bg-surface-container-high overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500/80" style={{ width: `${Math.max(4, (v.given / maxVaccineGiven) * 100)}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-on-surface w-8 text-right">{v.given}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-secondary font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">vaccines</span>
                Immunization coverage across {counts.villageCount} villages
              </p>
            </section>

            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
              <div className="px-5 py-3 border-b border-outline-variant">
                <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">sync</span>
                  ASHA Workers
                </h2>
              </div>
              <div className="overflow-x-auto">
                {ashaItems.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <span className="material-symbols-outlined text-[40px] text-outline">group_off</span>
                    <p className="text-body-md text-on-surface-variant">No ASHA workers registered.</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-outline-variant/50 bg-surface-container-low/50">
                        <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant">Worker</th>
                        <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant">Area</th>
                        <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant">Status</th>
                        <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ashaItems.slice(0, 5).map((w, i) => (
                        <tr key={w.id} className={`transition-colors hover:bg-surface-container-low/40 ${i < Math.min(ashaItems.length, 5) - 1 ? 'border-b border-outline-variant/40' : ''} ${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}`}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="size-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[11px] font-bold">{initials(w.name)}</div>
                              <div>
                                <p className="text-label-sm font-semibold text-on-surface">{w.name}</p>
                                <p className="text-[10px] text-on-surface-variant">{w.village || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-label-sm text-on-surface">{w.assignedHouseholds} households</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${w.status === 'active' ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'}`}>
                              <span className={`size-1.5 rounded-full ${w.status === 'active' ? 'bg-secondary' : 'bg-error'}`}></span>
                              {w.status === 'active' ? 'Active' : w.status === 'on_leave' ? 'On Leave' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[11px] text-on-surface-variant text-right whitespace-nowrap">
                            {w.performanceScore > 0 ? `${w.performanceScore}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>

          {villageBreakdown.length > 0 && (
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
              <div className="px-5 py-3 border-b border-outline-variant flex justify-between items-center">
                <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">location_on</span>
                  Village Overview
                </h2>
                <span className="text-caption text-on-surface-variant">{villageBreakdown.length} villages</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/50 bg-surface-container/50">
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant">Village</th>
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant text-center">Patients</th>
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant text-center">Pregnancies</th>
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant text-center">High Risk</th>
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant">ASHA Worker</th>
                    </tr>
                  </thead>
                  <tbody>
                    {villageBreakdown.map((v, i) => (
                      <tr key={v.village} className={`transition-colors hover:bg-surface-container/40 ${i < villageBreakdown.length - 1 ? 'border-b border-outline-variant/40' : ''} ${i % 2 === 0 ? 'bg-surface-container' : 'bg-surface'}`}>
                        <td className="px-5 py-3 text-label-sm font-semibold text-on-surface">{v.village}</td>
                        <td className="px-5 py-3 text-label-sm text-on-surface text-center">{v.patients}</td>
                        <td className="px-5 py-3 text-label-sm text-on-surface text-center">{v.pregnancies}</td>
                        <td className="px-5 py-3 text-center">
                          {v.highRisk > 0 ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-error-container text-on-error-container">
                              <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                              {v.highRisk}
                            </span>
                          ) : (
                            <span className="text-label-sm text-on-surface-variant">0</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-label-sm text-on-surface">{v.asha}</td>
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