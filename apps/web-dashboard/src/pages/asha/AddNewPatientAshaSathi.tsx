import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { useASHAStore, newPatientId } from '@/stores/asha.store'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import type { RiskLevel } from '@/pages/asha/mockData'

interface FormState {
  name: string
  abhaId: string
  mobile: string
  dob: string
  gender: string
  village: string
  householdId: string
  ashaWorker: string
  risk: RiskLevel
  notes: string
}

const RISK_OPTIONS: { value: RiskLevel; label: string; dot: string; ring: string }[] = [
  {
    value: 'low',
    label: 'asha.riskLow',
    dot: 'h-3 w-3 rounded-full border border-secondary bg-secondary-container',
    ring: 'peer-checked:border-secondary peer-checked:bg-secondary',
  },
  {
    value: 'medium',
    label: 'asha.riskMedium',
    dot: 'h-3 w-3 rounded-full border border-[orange] bg-[orange] opacity-60',
    ring: 'peer-checked:border-[orange] peer-checked:bg-[orange]',
  },
  {
    value: 'high',
    label: 'asha.riskHigh',
    dot: 'h-3 w-3 rounded-full border border-error bg-error-container',
    ring: 'peer-checked:border-error peer-checked:bg-error',
  },
]

const inputCls =
  'h-touch-target w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
const selectWrap =
  'absolute inset-y-0 right-0 flex items-center pr-4 text-on-surface-variant pointer-events-none'

export default function AddNewPatientAshaSathi() {
  const { t } = useLocalization()
  const navigate = useNavigate()
  const { addToast } = useUIStore()
  const { addPatient } = useASHAStore()

  const [form, setForm] = useState<FormState>({
    name: '',
    abhaId: '',
    mobile: '',
    dob: '',
    gender: '',
    village: '',
    householdId: '',
    ashaWorker: '',
    risk: 'low',
    notes: '',
  })
  const [saved, setSaved] = useState(false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const villageName: Record<string, string> = { v1: 'Rampur', v2: 'Sitapur', v3: 'Lakshmanpur' }
  const wardName: Record<string, string> = { v1: 'Ward 1', v2: 'Ward 2', v3: 'Ward 3' }

  const ageFromDob = (dob: string): number => {
    if (!dob) return 0
    const birth = new Date(dob)
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    const m = now.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1
    return Math.max(age, 0)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (saved) return
    setSaved(true)

    const village = villageName[form.village] ?? ''
    addPatient({
      id: newPatientId(),
      name: form.name.trim(),
      abhaId: form.abhaId.trim() || `BHF-${Date.now().toString().slice(-6)}`,
      age: ageFromDob(form.dob),
      gender: form.gender ? form.gender.charAt(0).toUpperCase() + form.gender.slice(1) : '—',
      bloodGroup: '—',
      phone: form.mobile ? `+91 ${form.mobile}` : '—',
      address: form.householdId ? `Household ${form.householdId}, ${village}` : village,
      village,
      ward: wardName[form.village] ?? '—',
      risk: form.risk,
      riskReason: form.risk === 'high' || form.risk === 'medium' ? (form.notes.trim() || 'Under monitoring') : undefined,
      registeredAt: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      activeConditions: form.notes.trim() ? [form.notes.trim()] : [],
    })

    addToast('success', t('asha.patientSavedToast'))
    setTimeout(() => navigate('/asha/patients'), 600)
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title={t('asha.newPatientTitle')}
        subtitle={t('asha.newPatientSubtitle')}
        breadcrumbs={[{ label: t('nav.ashaPatients'), to: '/asha/patients' }, { label: t('nav.newPatient') }]}
      />

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
            <Icon name="users" size={20} className="text-primary" />
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.personalInfo')}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="patient_name">
                {t('asha.fullName')} *
              </label>
              <input
                id="patient_name"
                className={inputCls}
                placeholder={t('asha.legalNamePlaceholder')}
                required
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="uid">
                {t('asha.abhaId')}
              </label>
              <input
                id="uid"
                className={inputCls}
                placeholder={t('asha.abhaPlaceholder')}
                type="text"
                value={form.abhaId}
                onChange={(e) => set('abhaId', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="mobile">
                {t('asha.mobileNumber')} *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 font-body-md text-body-md text-on-surface-variant">
                  +91
                </span>
                <input
                  id="mobile"
                  className={`${inputCls} pl-12`}
                  pattern="[0-9]{10}"
                  placeholder={t('asha.mobilePlaceholder')}
                  required
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => set('mobile', e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="dob">
                {t('asha.dob')} *
              </label>
              <input
                id="dob"
                className={inputCls}
                required
                type="date"
                value={form.dob}
                onChange={(e) => set('dob', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="gender">
                {t('asha.gender')} *
              </label>
              <div className="relative">
                <select
                  id="gender"
                  className={`${inputCls} appearance-none`}
                  required
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                >
                  <option value="" disabled>
                    {t('asha.selectGender')}
                  </option>
                  <option value="male">{t('asha.male')}</option>
                  <option value="female">{t('asha.female')}</option>
                  <option value="other">{t('asha.other')}</option>
                </select>
                <span className={selectWrap}>
                  <Icon name="chevronDown" size={20} />
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
            <Icon name="box" size={20} className="text-primary" />
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.familyHousehold')}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="village">
                {t('asha.villageLocality')} *
              </label>
              <div className="relative">
                <select
                  id="village"
                  className={`${inputCls} appearance-none`}
                  required
                  value={form.village}
                  onChange={(e) => set('village', e.target.value)}
                >
                  <option value="" disabled>
                    {t('asha.selectVillage')}
                  </option>
                  <option value="v1">Rampur</option>
                  <option value="v2">Sitapur</option>
                  <option value="v3">Lakshmanpur</option>
                </select>
                <span className={selectWrap}>
                  <Icon name="chevronDown" size={20} />
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="household_id">
                {t('asha.householdId')}
              </label>
              <input
                id="household_id"
                className={inputCls}
                placeholder={t('asha.householdPlaceholder')}
                type="text"
                value={form.householdId}
                onChange={(e) => set('householdId', e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-xl bg-tertiary-container" />
          <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-5 py-4 pl-8">
            <Icon name="heart" size={20} className="text-tertiary" />
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.initialAssessment')}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 pl-8">
            <div className="flex flex-col gap-1 md:w-1/2">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="asha_worker">
                {t('asha.assignedAsha')} *
              </label>
              <div className="relative">
                <select
                  id="asha_worker"
                  className={`${inputCls} appearance-none`}
                  required
                  value={form.ashaWorker}
                  onChange={(e) => set('ashaWorker', e.target.value)}
                >
                  <option value="" disabled>
                    {t('asha.selectWorker')}
                  </option>
                  <option value="w1">Sunita Devi (Rampur)</option>
                  <option value="w2">Anita Kumari (Sitapur)</option>
                </select>
                <span className={selectWrap}>
                  <Icon name="chevronDown" size={20} />
                </span>
              </div>
            </div>

            <div className="mt-1 flex flex-col gap-2">
              <label className="font-label-md text-label-md text-on-surface-variant">{t('asha.riskAssessment')}</label>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                {RISK_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="relative flex w-full cursor-pointer items-center rounded-lg border border-outline-variant p-4 transition-colors hover:bg-surface-container-low"
                  >
                    <input
                      className="peer sr-only"
                      name="risk_level"
                      type="radio"
                      value={option.value}
                      checked={form.risk === option.value}
                      onChange={() => set('risk', option.value)}
                    />
                    <div className={`mr-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-outline ${option.ring}`}>
                      <div className="hidden h-2.5 w-2.5 rounded-full bg-surface peer-checked:block" />
                    </div>
                    <span className="font-body-md text-body-md text-on-surface">{t(option.label)}</span>
                    <div className={`ml-auto ${option.dot}`} />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="notes">
                {t('asha.clinicalNotes')}
              </label>
              <textarea
                id="notes"
                className="min-h-[100px] resize-y rounded-lg border border-outline bg-surface p-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={t('asha.notesPlaceholder')}
                rows={3}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 pb-4">
          <button
            className="flex h-touch-target items-center justify-center rounded-full px-5 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-highest"
            type="button"
            onClick={() => navigate(-1)}
          >
            {t('common.cancel')}
          </button>
          <button
            className="flex h-touch-target items-center justify-center gap-2 rounded-full bg-primary px-6 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
            type="submit"
            disabled={saved}
          >
            <Icon name="save" size={18} />
            {t('asha.savePatient')}
          </button>
        </div>
      </form>
    </div>
  )
}
