import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useUIStore } from '@/stores/ui.store'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { beneficiaryService } from '@/services/beneficiary.service'
import { householdService } from '@/services/household.service'
import { getErrorMessage } from '@/components/common/ErrorState'

type RiskLevel = 'low' | 'medium' | 'high'

interface FormState {
  name: string
  abhaId: string
  mobile: string
  dob: string
  gender: string
  householdId: string
  risk: RiskLevel
  notes: string
}

const RISK_OPTIONS: { value: RiskLevel; label: string; color: string; ring: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-secondary', ring: 'peer-checked:border-secondary peer-checked:bg-secondary/10' },
  { value: 'medium', label: 'Medium', color: 'bg-tertiary', ring: 'peer-checked:border-tertiary peer-checked:bg-tertiary/10' },
  { value: 'high', label: 'High', color: 'bg-error', ring: 'peer-checked:border-error peer-checked:bg-error/10' },
]

const inputCls =
  'h-12 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

export default function AddNewPatientPhcAdmin() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addToast } = useUIStore()

  const [form, setForm] = useState<FormState>({
    name: '', abhaId: '', mobile: '', dob: '', gender: '', householdId: '', risk: 'low', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const {
    data: householdsData,
    isLoading: householdsLoading,
    isError: householdsError,
    error: householdsErrorObj,
  } = useQuery({
    queryKey: ['households', 'options'],
    queryFn: () => householdService.listHouseholds({ pageSize: 1000 }),
  })

  const households = householdsData?.items ?? []

  const selectedHousehold = households.find((h) => h.id === form.householdId)

  const savePatient = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return

    if (form.name.trim().length < 2) {
      addToast('error', 'Please enter the full name')
      return
    }
    if (!form.dob) {
      addToast('error', 'Please enter the date of birth')
      return
    }
    if (new Date(form.dob) > new Date()) {
      addToast('error', 'Date of birth cannot be in the future')
      return
    }
    if (!form.gender) {
      addToast('error', 'Please choose the gender')
      return
    }
    if (!form.householdId) {
      addToast('error', 'Please choose a household (village is linked to the household)')
      return
    }
    if (form.mobile.trim() && !/^[6-9]\d{9}$/.test(form.mobile.trim())) {
      addToast('error', 'Mobile must be a valid 10-digit number starting with 6-9')
      return
    }

    setSaving(true)
    try {
      await beneficiaryService.createBeneficiary({
        name: form.name.trim(),
        abhaId: form.abhaId.trim() || undefined,
        dob: form.dob,
        gender: form.gender as 'male' | 'female' | 'other',
        phone: form.mobile.trim() || undefined,
        householdId: form.householdId,
      })
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] })
      addToast('success', 'Patient registered successfully.')
      setTimeout(() => navigate('/phc/beneficiaries'), 600)
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Failed to register patient'
      addToast('error', msg)
      setSaving(false)
    }
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
                <span className="material-symbols-outlined text-primary text-[20px]">person_add</span>
                Register Patient
              </h2>
              <p className="text-caption text-on-surface-variant">
                <button onClick={() => navigate('/phc/beneficiaries')} className="text-primary hover:underline">Beneficiaries</button>
                <span className="mx-1 text-gray-500">/</span>
                <span>New Patient</span>
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <form className="max-w-4xl mx-auto flex flex-col gap-5" onSubmit={savePatient}>
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                <span className="material-symbols-outlined text-primary text-[20px]">person</span>
                <h3 className="text-lg font-semibold text-on-surface">Personal Information</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-label-md text-on-surface-variant" htmlFor="phc_patient_name">Full Name *</label>
                  <input id="phc_patient_name" className={`${inputCls} placeholder:text-gray-400`} placeholder="Enter legal name" type="text" value={form.name} onChange={(e) => set('name', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="phc_uid">ABHA ID</label>
                  <input id="phc_uid" className={inputCls} placeholder="Optional" type="text" value={form.abhaId} onChange={(e) => set('abhaId', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="phc_mobile">Mobile Number</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">+91</span>
                    <input id="phc_mobile" className={`${inputCls} pl-12`} pattern="[0-9]{10}" placeholder="10-digit mobile" type="tel" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="phc_dob">Date of Birth *</label>
                  <input id="phc_dob" className={inputCls} required type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="phc_gender">Gender *</label>
                  <div className="relative">
                    <select id="phc_gender" className={`${inputCls} appearance-none`} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                      <option value="" disabled>Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-on-surface-variant pointer-events-none">
                      <span className="material-symbols-outlined text-[20px]">expand_more</span>
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                <span className="material-symbols-outlined text-primary text-[20px]">home</span>
                <h3 className="text-headline-md font-semibold text-on-surface">Household Details</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 p-5">
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="phc_household">Household *</label>
                  <div className="relative">
                    <select id="phc_household" className={`${inputCls} appearance-none`} value={form.householdId} onChange={(e) => set('householdId', e.target.value)}>
                      <option value="" disabled>Select household</option>
                      {households.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.householdId}{h.village ? ` · ${h.village}` : ''}
                        </option>
                      ))}
                    </select>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-on-surface-variant pointer-events-none">
                      <span className="material-symbols-outlined text-[20px]">expand_more</span>
                    </span>
                  </div>
                  {householdsLoading && <p className="text-caption text-on-surface-variant">Loading households…</p>}
                  {householdsError && <p className="text-caption text-error">Failed to load households. {getErrorMessage(householdsErrorObj)}</p>}
                  {selectedHousehold && selectedHousehold.village && (
                    <p className="text-caption text-on-surface-variant">Village: <span className="font-semibold text-on-surface">{selectedHousehold.village}</span></p>
                  )}
                </div>
              </div>
            </section>

            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                <span className="material-symbols-outlined text-tertiary text-[20px]">favorite</span>
                <h3 className="text-headline-md font-semibold text-on-surface">Initial Assessment</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 p-5">
                <div className="flex flex-col gap-2">
                  <label className="text-label-md text-on-surface-variant">Risk Level</label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    {RISK_OPTIONS.map((option) => {
                      const isSelected = form.risk === option.value
                      return (
                        <label key={option.value} className={`relative flex w-full cursor-pointer items-center rounded-lg ${isSelected ? 'border-2' : 'border'} border-outline-variant p-4 transition-colors hover:bg-surface-container-low ${option.ring}`}>
                          <input className="peer sr-only" name="risk_level" type="radio" value={option.value} checked={isSelected} onChange={() => set('risk', option.value)} />
                          <div className="mr-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-outline peer-checked:border-current">
                            <div className="hidden h-2.5 w-2.5 rounded-full bg-current peer-checked:block" />
                          </div>
                          <span className="text-body-md text-on-surface">{option.label}</span>
                          <div className={`ml-auto h-3 w-3 rounded-full ${option.color}`} />
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="phc_notes">Clinical Notes</label>
                  <textarea
                    id="phc_notes"
                    className="min-h-[100px] resize-y rounded-lg border border-outline bg-surface p-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Add observations, conditions, notes..."
                    rows={3}
                    value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                  />
                </div>
              </div>
            </section>

            <div className="flex items-center justify-end gap-3 pb-4">
              <button
                className="flex items-center justify-center rounded-full px-5 py-2 font-label-md text-label-md font-semibold text-gray-600 transition-colors hover:bg-surface-container-highest"
                type="button"
                onClick={() => navigate(-1)}
              >
                Cancel
              </button>
              <button
                className="flex items-center justify-center gap-2 rounded-full bg-green-600 px-6 py-2 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60"
                type="submit"
                disabled={saving}
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {saving ? 'Saving…' : 'Save Patient'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}