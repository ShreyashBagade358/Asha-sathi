import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useUIStore } from '@/stores/ui.store'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { pregnancyService } from '@/services/pregnancy.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'

const DANGER_SIGNS = ['Fever', 'Cough', 'Headache', 'Body Ache', 'Bleeding', 'Reduced Movement', 'Swelling', 'Other']

const inputCls =
  'h-12 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

function ageFromDob(dob: string): number {
  if (!dob) return 0
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return 0
  let age = new Date().getFullYear() - d.getFullYear()
  const m = new Date().getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) age -= 1
  return Math.max(0, age)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function NewHealthCheckUpPhcAdmin() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addToast } = useUIStore()

  const [pregnancyId, setPregnancyId] = useState('')
  const [visitDate, setVisitDate] = useState(today())
  const [bpSystolic, setBpSystolic] = useState('')
  const [bpDiastolic, setBpDiastolic] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [hemoglobin, setHemoglobin] = useState('')
  const [fundalHeightCm, setFundalHeightCm] = useState('')
  const [fetalHeartRate, setFetalHeartRate] = useState('')
  const [dangerSigns, setDangerSigns] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const pregnancies = useQuery({
    queryKey: ['pregnancies', 'all'],
    queryFn: () => pregnancyService.listPregnancies({ pageSize: 1000 }),
  })
  const beneficiaries = useQuery({
    queryKey: ['beneficiaries', 'all'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })

  const pregItems = pregnancies.data?.items ?? []
  const benMap = new Map((beneficiaries.data?.items ?? []).map((b) => [b.id, b]))

  const activePregnancies = pregItems.filter((p) => p.status === 'active')
  const selected = pregItems.find((p) => p.id === pregnancyId)
  const selectedBen = selected ? benMap.get(selected.beneficiaryId) : undefined

  const ancVisits = useQuery({
    queryKey: ['anc-visits', pregnancyId],
    queryFn: () => pregnancyService.listANCVisits(pregnancyId),
    enabled: !!pregnancyId,
  })

  const toggleSign = (sign: string) => {
    setDangerSigns((prev) => (prev.includes(sign) ? prev.filter((s) => s !== sign) : [...prev, sign]))
  }

  const num = (v: string): number | undefined => {
    const n = Number(v)
    return v !== '' && Number.isFinite(n) ? n : undefined
  }

  const saveCheckup = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!pregnancyId) {
      addToast('error', 'Please select an active pregnancy')
      return
    }
    if (!visitDate) {
      addToast('error', 'Please choose the visit date')
      return
    }

    setSaving(true)
    try {
      await pregnancyService.addANCVisit(pregnancyId, {
        visitNumber: (ancVisits.data?.length ?? 0) + 1,
        visitDate,
        bpSystolic: num(bpSystolic),
        bpDiastolic: num(bpDiastolic),
        weightKg: num(weightKg),
        heightCm: num(heightCm),
        hemoglobin: num(hemoglobin),
        fundalHeightCm: num(fundalHeightCm),
        fetalHeartRate: num(fetalHeartRate),
        dangerSigns: dangerSigns.length ? dangerSigns : undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['pregnancies'] })
      queryClient.invalidateQueries({ queryKey: ['anc-visits'] })
      addToast('success', 'Check-up recorded successfully.')
      navigate('/phc/health-checkups/history')
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Failed to record check-up'
      addToast('error', msg)
      setSaving(false)
    }
  }

  const isLoading = pregnancies.isLoading || beneficiaries.isLoading
  const isError = pregnancies.isError || beneficiaries.isError
  const error = pregnancies.error ?? beneficiaries.error

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div>
            <h2 className="text-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">stethoscope</span>
              New Health Check-up
            </h2>
            <p className="text-caption text-on-surface-variant">Record an ANC visit for an active pregnancy.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {isLoading ? (
            <LoadingState label="Loading pregnancies…" />
          ) : isError ? (
            <ErrorState message={getErrorMessage(error)} onRetry={() => {
              pregnancies.refetch()
              beneficiaries.refetch()
            }} />
          ) : (
            <form className="max-w-4xl mx-auto flex flex-col gap-5" onSubmit={saveCheckup}>
              <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                  <span className="material-symbols-outlined text-secondary text-[20px]">pregnant_woman</span>
                  <h3 className="text-lg font-semibold text-on-surface">Patient Selection</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 p-5">
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="checkup_patient">Pregnancy / Patient *</label>
                    <div className="relative">
                      <select
                        id="checkup_patient"
                        className={`${inputCls} appearance-none`}
                        value={pregnancyId}
                        onChange={(e) => setPregnancyId(e.target.value)}
                      >
                        <option value="" disabled>Select an active pregnancy</option>
                        {activePregnancies.map((p) => (
                          <option key={p.id} value={p.id}>
                            {benMap.get(p.beneficiaryId)?.name ?? 'Beneficiary'} · EDD {p.edd ? new Date(p.edd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                          </option>
                        ))}
                      </select>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-on-surface-variant pointer-events-none">
                        <span className="material-symbols-outlined text-[20px]">expand_more</span>
                      </span>
                    </div>
                    {activePregnancies.length === 0 && (
                      <p className="text-caption text-error">No active pregnancies yet.</p>
                    )}
                  </div>

                  {selected && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 rounded-lg bg-surface-container/60 border border-outline-variant/50 p-4">
                      <div>
                        <p className="text-caption text-on-surface-variant">Patient</p>
                        <p className="text-label-md font-semibold text-on-surface">{selectedBen?.name ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-caption text-on-surface-variant">Age / Gender</p>
                        <p className="text-label-md text-on-surface">
                          {selectedBen?.dob ? `${ageFromDob(selectedBen.dob)} Y` : '—'} / {selectedBen?.gender ? selectedBen.gender.charAt(0).toUpperCase() + selectedBen.gender.slice(1) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-caption text-on-surface-variant">Village</p>
                        <p className="text-label-md text-on-surface">{selectedBen?.village || '—'}</p>
                      </div>
                      <div>
                        <p className="text-caption text-on-surface-variant">ANC Visits</p>
                        <p className="text-label-md text-on-surface">{ancVisits.data?.length ?? 0}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="bg-surface-container-lowest border border-outline-variant rounded-xl px-5 py-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary text-[20px]">monitor_heart</span>
                  <h3 className="text-lg font-semibold text-on-surface">Vitals</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="checkup_date">Visit Date *</label>
                    <input id="checkup_date" className={inputCls} type="date" required value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="checkup_bp">Blood Pressure (mmHg)</label>
                    <div className="flex gap-2">
                      <input
                        id="checkup_bp"
                        className={inputCls}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="Systolic"
                        value={bpSystolic}
                        onChange={(e) => setBpSystolic(e.target.value)}
                      />
                      <input
                        className={inputCls}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="Diastolic"
                        value={bpDiastolic}
                        onChange={(e) => setBpDiastolic(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="checkup_weight">Weight (kg)</label>
                    <input id="checkup_weight" className={inputCls} type="number" inputMode="decimal" min={0} step="0.1" placeholder="e.g. 62.5" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="checkup_height">Height (cm)</label>
                    <input id="checkup_height" className={inputCls} type="number" inputMode="decimal" min={0} step="0.1" placeholder="e.g. 155" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="checkup_hb">Hemoglobin (g/dL)</label>
                    <input id="checkup_hb" className={inputCls} type="number" inputMode="decimal" min={0} step="0.1" placeholder="e.g. 10.5" value={hemoglobin} onChange={(e) => setHemoglobin(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="checkup_fundal">Fundal Height (cm)</label>
                    <input id="checkup_fundal" className={inputCls} type="number" inputMode="decimal" min={0} step="0.1" placeholder="e.g. 30" value={fundalHeightCm} onChange={(e) => setFundalHeightCm(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-label-md text-on-surface-variant" htmlFor="checkup_fhr">Fetal Heart Rate (bpm)</label>
                    <input id="checkup_fhr" className={inputCls} type="number" inputMode="numeric" min={0} placeholder="e.g. 140" value={fetalHeartRate} onChange={(e) => setFetalHeartRate(e.target.value)} />
                  </div>
                </div>
              </section>

              <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-tertiary text-[20px]">medication</span>
                  <h3 className="text-lg font-semibold text-on-surface">Danger Signs</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DANGER_SIGNS.map((sign) => {
                    const on = dangerSigns.includes(sign)
                    return (
                      <button
                        key={sign}
                        type="button"
                        onClick={() => toggleSign(sign)}
                        className={`px-4 py-2 rounded-full border text-label-md transition-colors ${
                          on
                            ? 'bg-tertiary-container text-on-tertiary-container border-tertiary-container'
                            : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        {sign}
                      </button>
                    )
                  })}
                </div>
              </section>

              <div className="flex items-center justify-end gap-3 pb-4">
                <button type="button" className="rounded-full px-5 py-2 text-label-md font-semibold text-on-surface-variant hover:bg-surface-container transition-colors" onClick={() => navigate(-1)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2 text-label-md font-semibold text-on-primary shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  {saving ? 'Saving…' : 'Save Record'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}