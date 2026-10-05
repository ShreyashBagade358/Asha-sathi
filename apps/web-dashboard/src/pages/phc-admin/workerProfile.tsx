import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { ashaService, type ASHADetail } from '@/services/asha.service'
import { userService } from '@/services/user.service'
import { householdService } from '@/services/household.service'
import { configService } from '@/services/config.service'
import { useUIStore } from '@/stores/ui.store'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'

interface PhcInfo {
  name?: string
  code?: string
  address?: string
  contact_phone?: string
  head_officer_name?: string
  sub_centers?: unknown[]
}

/**
 * The route param is the ASHA code (`ASHA-UP-LKO-0001`), which is what
 * `GET /ashas/{id}` expects. Older links and the beneficiary page pass the
 * ASHA's user UUID instead — resolve it through the directory rather than 404.
 */
async function fetchDetail(idOrCode: string): Promise<ASHADetail> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrCode)) return ashaService.getASHADetail(idOrCode)
  try {
    return await ashaService.getASHADetail(idOrCode)
  } catch (err) {
    const list = await ashaService.listASHAs({ pageSize: 1000 })
    const match = list.items.find((a) => a.id === idOrCode)
    if (!match) throw err
    return ashaService.getASHADetail(match.ashaId)
  }
}

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
    queryFn: () => fetchDetail(id!),
    enabled: !!id,
  })

  const account = useQuery({
    queryKey: ['user-account', data?.asha.id],
    queryFn: () => userService.get(data!.asha.id),
    enabled: Boolean(data?.asha.id),
  })

  const phc = useQuery({
    queryKey: ['phc', account.data?.phcId],
    queryFn: async () => (await configService.getPHC(account.data!.phcId!)) as PhcInfo,
    enabled: Boolean(account.data?.phcId),
  })

  const households = useQuery({
    queryKey: ['asha-households', data?.asha.id],
    queryFn: () => householdService.listHouseholds({ ashaId: data!.asha.id, pageSize: 5 }),
    enabled: Boolean(data?.asha.id),
  })

  const qc = useQueryClient()
  const { addToast } = useUIStore()
  const [editingVillages, setEditingVillages] = useState(false)
  const [villageFilter, setVillageFilter] = useState('')

  const blocksQuery = useQuery({
    queryKey: ['config', 'blocks', account.data?.districtId],
    queryFn: () => configService.getBlocks(account.data!.districtId!),
    enabled: Boolean(account.data?.districtId),
  })
  const [picked, setPicked] = useState<string[]>([])

  // Villages the PHC can hand out — loaded whenever the account has a PHC so
  // the edit flow can map the ASHA's current (name) list onto ids.
  const phcVillages = useQuery({
    queryKey: ['villages', account.data?.phcId],
    queryFn: () => configService.getVillages(account.data!.phcId!),
    enabled: Boolean(account.data?.phcId),
  })

  const assign = useMutation({
    mutationFn: (villages: string[]) => ashaService.assignVillages(data!.asha.ashaId, villages),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asha-detail', id] })
      setEditingVillages(false)
      addToast('success', 'Catchment villages updated.')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const startEditingVillages = () => {
    const options = phcVillages.data ?? []
    setPicked(data!.villages.map((name) => options.find((o) => o.name === name)?.id ?? name))
    setVillageFilter('')
    setEditingVillages(true)
  }

  const toggleVillage = (ident: string) =>
    setPicked((prev) => (prev.includes(ident) ? prev.filter((x) => x !== ident) : [...prev, ident]))

  const filterQuery = villageFilter.trim().toLowerCase()
  const villageOptions = (phcVillages.data ?? []).filter(
    (o) => !filterQuery || o.name.toLowerCase().includes(filterQuery) || (o.code ?? '').toLowerCase().includes(filterQuery),
  )

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
                <Link to="/phc/ashas" className="text-primary hover:underline">Workers</Link>
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
                <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary-container text-on-primary-container text-headline-lg font-headline-lg">
                  {account.data?.avatarUrl ? (
                    <img src={account.data.avatarUrl} alt={worker.name} className="h-full w-full object-cover" />
                  ) : (
                    initials(worker.name)
                  )}
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
                <a
                  href={`tel:+91${worker.phone}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary-container px-4 py-2 text-label-md font-semibold text-on-primary-container transition-colors hover:bg-primary hover:text-on-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">call</span>
                  Call
                </a>
                <a
                  href={`sms:+91${worker.phone}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  Message
                </a>
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
                  { label: 'Email', value: account.data?.email || '—', icon: 'mail' },
                  { label: 'District', value: account.data?.districtName || '—', icon: 'map' },
                  {
                    label: 'Block',
                    value: account.data?.blockId
                      ? blocksQuery.isLoading
                        ? '…'
                        : blocksQuery.data?.find((b) => b.id === account.data?.blockId)?.name || '—'
                      : '—',
                    icon: 'travel_explore',
                  },
                  {
                    label: 'Last Login',
                    value: account.data?.lastLoginAt
                      ? new Date(account.data.lastLoginAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Never',
                    icon: 'schedule',
                  },
                  { label: 'Households Assigned', value: String(assignedBeneficiaries), icon: 'home' },
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
                {!editingVillages && account.data?.phcId && (
                  <button
                    type="button"
                    onClick={startEditingVillages}
                    className="ml-2 inline-flex items-center gap-1 rounded-full border border-outline px-3 py-1 text-caption font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                    Edit
                  </button>
                )}
              </h3>
              {editingVillages ? (
                <div className="space-y-3">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-on-surface-variant pointer-events-none">
                      <span className="material-symbols-outlined text-[18px]">search</span>
                    </span>
                    <input
                      className="h-11 w-full rounded-lg border border-outline bg-surface pl-9 pr-3 text-label-sm text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Search village or code…"
                      value={villageFilter}
                      onChange={(e) => setVillageFilter(e.target.value)}
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-outline-variant">
                    {phcVillages.isLoading ? (
                      <p className="px-4 py-4 text-label-sm text-on-surface-variant">Loading villages…</p>
                    ) : villageOptions.length === 0 ? (
                      <p className="px-4 py-4 text-label-sm text-on-surface-variant">No village matches.</p>
                    ) : (
                      villageOptions.slice(0, 200).map((o) => (
                        <label
                          key={o.id}
                          className="flex cursor-pointer items-center gap-3 border-b border-outline-variant/40 px-4 py-2.5 last:border-b-0 hover:bg-surface-container-low"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={picked.includes(o.id)}
                            onChange={() => toggleVillage(o.id)}
                          />
                          <span className="text-label-sm font-semibold text-on-surface">{o.name}</span>
                          {o.code && <span className="ml-auto text-caption text-on-surface-variant">{o.code}</span>}
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-caption text-on-surface-variant">{picked.length} village(s) selected</p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingVillages(false)}
                      className="rounded-full border border-outline px-5 py-2 text-label-md font-semibold text-gray-600 transition-colors hover:bg-surface-container-highest"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={assign.isPending}
                      onClick={() => assign.mutate(picked)}
                      className="inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-2 text-label-md font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60"
                    >
                      {assign.isPending && (
                        <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      )}
                      Save Villages
                    </button>
                  </div>
                </div>
              ) : villages.length === 0 ? (
                <p className="text-body-md text-on-surface-variant text-center py-8">No villages assigned.</p>
              ) : (
                <div className="space-y-2">
                  {villages.map((v, i) => (
                    <div
                      key={`${v}-${i}`}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
              <h3 className="text-headline-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">corporate_fare</span>
                Assigned PHC
              </h3>
              {!account.data?.phcId ? (
                <p className="text-body-md text-on-surface-variant text-center py-8">
                  No PHC is linked to this ASHA&apos;s account yet.
                </p>
              ) : phc.isLoading ? (
                <p className="text-body-md text-on-surface-variant text-center py-8">Loading PHC…</p>
              ) : phc.isError ? (
                <p className="text-body-md text-error text-center py-8">{getErrorMessage(phc.error)}</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'PHC Name', value: phc.data?.name || account.data?.phcName || '—', icon: 'location_city' },
                    { label: 'PHC Code', value: phc.data?.code || '—', icon: 'tag' },
                    { label: 'Address', value: phc.data?.address || '—', icon: 'map' },
                    { label: 'Contact Number', value: phc.data?.contact_phone || '—', icon: 'call' },
                    { label: 'Head Officer', value: phc.data?.head_officer_name || '—', icon: 'badge' },
                    { label: 'Sub-centres', value: String(phc.data?.sub_centers?.length ?? 0), icon: 'hub' },
                    { label: 'District', value: account.data?.districtName || '—', icon: 'travel_explore' },
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
              )}
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
              <h3 className="text-headline-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">house</span>
                Households &amp; Patients
                <span className="text-caption text-on-surface-variant ml-auto">{households.data?.total ?? 0} total</span>
              </h3>
              {households.isLoading ? (
                <p className="text-body-md text-on-surface-variant text-center py-8">Loading households…</p>
              ) : households.isError ? (
                <p className="text-body-md text-error text-center py-8">{getErrorMessage(households.error)}</p>
              ) : (households.data?.items.length ?? 0) === 0 ? (
                <div className="text-center py-8 space-y-1">
                  <p className="text-body-md text-on-surface-variant">No households assigned yet.</p>
                  <p className="text-caption text-on-surface-variant">
                    Patients are tracked through assigned households — none are linked to this ASHA.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {households.data!.items.map((h) => (
                    <Link
                      key={h.id}
                      to={`/phc/households/${h.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/50 px-4 py-3 transition-colors hover:bg-surface-container-low"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                          <span className="material-symbols-outlined text-[18px]">home</span>
                        </span>
                        <div className="min-w-0">
                          <p className="text-label-md font-semibold text-on-surface truncate">{h.householdId}</p>
                          <p className="text-caption text-on-surface-variant truncate">
                            {h.village || '—'} · {h.headName || 'Head not recorded'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded-full bg-secondary-container px-2 py-0.5 text-caption font-semibold text-on-secondary-container">
                          {h.memberCount} members
                        </span>
                        {h.pregnantWomen > 0 && (
                          <span className="rounded-full bg-tertiary-container px-2 py-0.5 text-caption font-semibold text-on-tertiary-container">
                            {h.pregnantWomen} pregnant
                          </span>
                        )}
                        {h.childrenUnder5 > 0 && (
                          <span className="rounded-full bg-primary-container px-2 py-0.5 text-caption font-semibold text-on-primary-container">
                            {h.childrenUnder5} under 5
                          </span>
                        )}
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">visibility</span>
                      </div>
                    </Link>
                  ))}
                  {(households.data?.total ?? 0) > (households.data?.items.length ?? 0) && (
                    <Link to="/phc/households" className="block pt-1 text-label-md font-semibold text-primary hover:underline text-center">
                      View all households
                    </Link>
                  )}
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
