import { useMemo, useRef, useState } from 'react'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { childService } from '@/services/child.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { useUIStore } from '@/stores/ui.store'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { GrowthRecord } from '@/types'

type MetricKey = 'weight' | 'height' | 'muac'

function ageLabel(dob: string): string {
  if (!dob) return '—'
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return '—'
  const months = Math.max(0, Math.floor((Date.now() - d.getTime()) / (30.44 * 86400000)))
  return months >= 24
    ? `${Math.floor(months / 12)} Years Old (Born: ${d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit', year: 'numeric' })})`
    : `${months} Months Old (Born: ${d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit', year: 'numeric' })})`
}

function nutritionBadge(record: GrowthRecord | null) {
  if (!record) {
    return {
      label: 'No measurements yet',
      note: 'Record the first weight/height check-up to start nutrition monitoring.',
      className: 'text-on-surface-variant',
      icon: 'timeline',
    }
  }
  const status = record.nutritionStatus ?? (record.zScoreWfa != null && record.zScoreWfa < -2 ? 'malnourished' : 'monitored')
  if (status === 'malnourished' || (record.zScoreWfa != null && record.zScoreWfa < -2)) {
    return {
      label: 'Malnourished',
      note: `Latest z-score (WFA): ${record.zScoreWfa}. Referral recommended.`,
      className: 'bg-error-container text-on-error-container',
      icon: 'warning',
    }
  }
  return {
    label: 'On Track',
    note: 'Latest weight is on a healthy growth trajectory.',
    className: 'bg-secondary-container text-on-secondary-container',
    icon: 'check_circle',
  }
}

export default function GrowthNutritionMonitoringPhcAdmin() {
  const qc = useQueryClient()
  const { addToast } = useUIStore()

  const { data: childrenData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['children', 'nutrition'],
    queryFn: () => childService.listChildren({ page: 1, pageSize: 1000 }),
  })

  const { data: benData } = useQuery({
    queryKey: ['beneficiaries-map'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })

  const beneficiaryMap = useMemo(() => {
    const m = new Map<string, { name: string; village: string; dob: string }>()
    for (const b of benData?.items ?? []) {
      m.set(b.id, { name: b.name, village: b.village, dob: b.dob })
    }
    return m
  }, [benData])

  const children = useMemo(
    () =>
      (childrenData?.items ?? []).map((c) => {
        const ben = beneficiaryMap.get(c.beneficiary_id)
        return {
          id: c.id,
          name: ben?.name ?? 'Child',
          village: ben?.village ?? '—',
          dob: ben?.dob ?? '',
        }
      }),
    [childrenData, beneficiaryMap],
  )

  const [selectedId, setSelectedId] = useState('')
  const selected = children.find((c) => c.id === selectedId) ?? null

  const [metric, setMetric] = useState<MetricKey>('weight')
  const [showLog, setShowLog] = useState(false)
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [muacCm, setMuacCm] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputs = useRef(new Map<string, HTMLInputElement>())

  const { data: growthRecords, isLoading: growthLoading, isError: growthError } = useQuery({
    queryKey: ['child-growth', selectedId],
    queryFn: () => childService.listGrowthRecords(selectedId),
    enabled: !!selectedId,
  })

  const sortedRecords = useMemo(
    () => [...(growthRecords ?? [])].sort((a, b) => a.recordDate.localeCompare(b.recordDate)),
    [growthRecords],
  )
  const latest = sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1] : null

  const chartData = useMemo(() => {
    return sortedRecords.map((r) => ({
      label: r.recordDate,
      value: metric === 'weight' ? r.weightKg ?? 0 : metric === 'height' ? r.heightCm ?? 0 : r.muacCm ?? 0,
    }))
  }, [sortedRecords, metric])

  const badge = nutritionBadge(latest)

  const addGrowthMutation = useMutation({
    mutationFn: () =>
      childService.createGrowthRecord(selectedId, {
        recordDate: logDate,
        weightKg: weight ? Number(weight) : undefined,
        heightCm: height ? Number(height) : undefined,
        muacMm: muacCm ? Number(muacCm) * 10 : undefined,
        nutritionStatus: 'monitored',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['child-growth', selectedId] })
      addToast('success', 'Growth measurement recorded.')
      setShowLog(false)
      setWeight('')
      setHeight('')
      setMuacCm('')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
    onSettled: () => setSaving(false),
  })

  const saveGrowth = () => {
    if (!selected) return
    setSaving(true)
    addGrowthMutation.mutate()
  }

  const uploadPhotoMutation = useMutation({
    mutationFn: ({ recordId, file }: { recordId: string; file: File }) =>
      childService.uploadGrowthPhoto(selectedId, recordId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['child-growth', selectedId] })
      addToast('success', 'Photo uploaded to growth record.')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
    onSettled: () => setUploadingId(null),
  })

  const handleFileChosen = (record: GrowthRecord, file: File | undefined) => {
    if (!selected || !file) return
    setUploadingId(record.id)
    uploadPhotoMutation.mutate({ recordId: record.id, file })
  }

  const deletePhotoMutation = useMutation({
    mutationFn: (recordId: string) => childService.deleteGrowthPhoto(selectedId, recordId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['child-growth', selectedId] })
      addToast('success', 'Photo removed.')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto"><LoadingState label="Loading nutrition data…" /></main>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto"><ErrorState message={getErrorMessage(error)} onRetry={refetch} /></main>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-8 max-w-[1440px] mx-auto pb-24 md:pb-0 overflow-y-auto flex flex-col">
        {children.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-14 text-center">
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant">monitor_weight</span>
            <p className="text-headline-md text-on-surface">No children available</p>
            <p className="max-w-md text-body-md text-on-surface-variant">Register children to view growth and nutrition monitoring.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-3xl font-semibold text-on-surface mb-1">{selected?.name ?? '—'}</h2>
                  <select
                    className="h-10 px-3 bg-surface border border-outline-variant rounded-md text-label-md text-on-surface focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    aria-label="Select child"
                  >
                    <option value="">Select child…</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} — {c.village}</option>
                    ))}
                  </select>
                </div>
                {selected && (
                  <div className="flex flex-wrap items-center gap-2 text-on-surface-variant text-body-md">
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">calendar_today</span> {ageLabel(selected.dob)}</span>
                    <span className="hidden md:inline">•</span>
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">location_on</span> Village: {selected.village || '—'}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowLog((v) => !v)}
                className="bg-primary text-on-primary text-label-md px-4 h-12 rounded-full flex items-center gap-1 shadow-sm hover:opacity-90 transition-opacity w-full md:w-auto justify-center"
              >
                <span className="material-symbols-outlined">{showLog ? 'close' : 'add_circle'}</span>
                {showLog ? 'Close' : 'Log Growth'}
              </button>
            </div>

            {showLog && selected && (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm mb-6">
                <h3 className="text-lg font-semibold text-on-surface mb-4">Log Growth Measurement</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-caption text-on-surface-variant block mb-1">Date</label>
                    <input
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-caption text-on-surface-variant block mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="e.g. 6.2"
                      className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-caption text-on-surface-variant block mb-1">Height (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="e.g. 64"
                      className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-caption text-on-surface-variant block mb-1">MUAC (cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={muacCm}
                        onChange={(e) => setMuacCm(e.target.value)}
                        placeholder="e.g. 13.5"
                        className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <button
                      onClick={saveGrowth}
                      disabled={saving}
                      className="h-11 px-4 bg-primary text-on-primary rounded-lg text-label-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-4 flex flex-col gap-6">
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-on-surface mb-4">Nutrition Status</h3>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-md font-semibold ${badge.className}`}>
                    <span className="material-symbols-outlined text-[16px]">{badge.icon}</span> {badge.label}
                  </span>
                  <p className="mt-3 text-body-md text-on-surface-variant">{badge.note}</p>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-on-surface mb-4">Latest Snapshot</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-caption text-on-surface-variant">Weight</div>
                      <div className="text-2xl font-semibold text-on-surface">{latest?.weightKg != null ? `${latest.weightKg} kg` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-caption text-on-surface-variant">Height</div>
                      <div className="text-2xl font-semibold text-on-surface">{latest?.heightCm != null ? `${latest.heightCm} cm` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-caption text-on-surface-variant">MUAC</div>
                      <div className="text-2xl font-semibold text-on-surface">{latest?.muacCm != null ? `${latest.muacCm} cm` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-caption text-on-surface-variant">Date</div>
                      <div className="text-body-md text-on-surface">{latest?.recordDate ?? '—'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-8 flex flex-col gap-6">
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-on-surface">Growth Charts (WHO)</h3>
                    <select
                      className="bg-surface border border-outline-variant rounded-md text-label-md text-on-surface h-12 px-3 focus:ring-2 focus:ring-primary"
                      value={metric}
                      onChange={(e) => setMetric(e.target.value as MetricKey)}
                    >
                      <option value="weight">Weight-for-Age</option>
                      <option value="height">Height-for-Age</option>
                      <option value="muac">MUAC-for-Age</option>
                    </select>
                  </div>
                  {chartData.length > 1 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e3e1" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: '#3e4949', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#bdc9c8' }} />
                        <YAxis tick={{ fill: '#3e4949', fontSize: 12 }} tickLine={false} axisLine={false} width={44} />
                        <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#e2e3e1' }} />
                        <Line type="monotone" dataKey="value" stroke="#006565" strokeWidth={2.5} dot={{ r: 3, fill: '#006565', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="relative w-full h-64 md:h-80 bg-surface-container-low rounded-lg border border-outline-variant flex items-center justify-center text-body-md text-on-surface-variant">
                      {growthLoading ? 'Loading growth data…' : growthError ? 'Failed to load growth data' : 'At least two measurements are needed to chart growth'}
                    </div>
                  )}
                </div>

                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-on-surface">Measurement History</h3>
                    <span className="text-caption text-on-surface-variant">{sortedRecords.length} record{sortedRecords.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low text-on-surface text-label-md border-b border-outline-variant">
                          <th className="p-3 md:p-4 whitespace-nowrap">Photo</th>
                          <th className="p-3 md:p-4 whitespace-nowrap">Date</th>
                          <th className="p-3 md:p-4 whitespace-nowrap">Weight (kg)</th>
                          <th className="p-3 md:p-4 whitespace-nowrap">Height (cm)</th>
                          <th className="p-3 md:p-4 whitespace-nowrap">MUAC (cm)</th>
                          <th className="p-3 md:p-4 whitespace-nowrap"></th>
                        </tr>
                      </thead>
                      <tbody className="text-body-md text-on-surface">
                        {sortedRecords.length === 0 ? (
                          <tr className="border-b border-outline-variant">
                            <td className="p-3 md:p-4 text-on-surface-variant" colSpan={6}>No records yet — log the first measurement.</td>
                          </tr>
                        ) : (
                          sortedRecords.map((record) => (
                            <tr key={record.id} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                              <td className="p-3 md:p-4">
                                {record.photoUrl ? (
                                  <img
                                    src={record.photoUrl}
                                    alt={`Growth photo ${record.recordDate}`}
                                    className="h-12 w-12 rounded-lg object-cover border border-outline-variant"
                                  />
                                ) : (
                                  <button
                                    onClick={() => fileInputs.current.get(record.id)?.click()}
                                    disabled={uploadingId === record.id}
                                    className="h-10 px-3 rounded-lg border border-outline-variant text-on-surface-variant text-label-md hover:bg-surface-container transition-colors flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
                                    {uploadingId === record.id ? 'Uploading…' : 'Add photo'}
                                  </button>
                                )}
                                <input
                                  ref={(el) => {
                                    if (el) fileInputs.current.set(record.id, el)
                                    else fileInputs.current.delete(record.id)
                                  }}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleFileChosen(record, e.target.files?.[0])}
                                />
                              </td>
                              <td className="p-3 md:p-4 whitespace-nowrap">{record.recordDate}</td>
                              <td className="p-3 md:p-4">{record.weightKg ?? '—'}</td>
                              <td className="p-3 md:p-4">{record.heightCm ?? '—'}</td>
                              <td className="p-3 md:p-4">{record.muacCm ?? '—'}</td>
                              <td className="p-3 md:p-4 text-right">
                                {record.photoUrl && (
                                  <button
                                    onClick={() => deletePhotoMutation.mutate(record.id)}
                                    disabled={deletePhotoMutation.isPending}
                                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/40 transition-colors disabled:opacity-50"
                                    title="Remove photo"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}