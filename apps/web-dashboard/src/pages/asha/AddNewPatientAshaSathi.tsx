import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ASHAButton, ASHACard } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { useASHAStore } from '@/stores/asha.store'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { apiErrorMessage, patientService, type RegisteredPatient } from '@/services/patient.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { PhotoUploadField } from '@/components/common/PhotoUploadField'
import { ashaService } from '@/services/asha.service'
import { configService } from '@/services/config.service'
import { SearchableSelect } from '@/components/common/SearchableSelect'
import { useAuth } from '@/hooks/useAuth'
import { NOT_RECORDED } from '@/hooks/usePatientProfile'
import type { RiskLevel } from '@/pages/asha/mockData'

interface FormState {
  name: string
  abhaId: string
  mobile: string
  dob: string
  gender: string
  village: string
  householdId: string
  bloodGroup: string
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="font-caption text-caption text-error" role="alert">
      {message}
    </p>
  )
}

export default function AddNewPatientAshaSathi() {
  const { t } = useLocalization()
  const navigate = useNavigate()
  const { addToast } = useUIStore()
  const { addPatient } = useASHAStore()
  const { user } = useAuth()
  const phcId = user?.phcId

  const { data: ashaData } = useQuery({
    queryKey: ['ashas', 'select', 1],
    queryFn: () => ashaService.listASHAs({ page: 1, pageSize: 50 }),
  })
  const ashaWorkers = ashaData?.items ?? []

  const { data: villageData, isLoading: villagesLoading } = useQuery({
    queryKey: ['villages', phcId],
    queryFn: () => configService.getVillages(phcId!),
    enabled: Boolean(phcId),
  })
  const villages = villageData ?? []

  const [form, setForm] = useState<FormState>({
    name: '',
    abhaId: '',
    mobile: '',
    dob: '',
    gender: '',
    village: '',
    householdId: '',
    bloodGroup: '',
    ashaWorker: '',
    risk: 'low',
    notes: '',
  })
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [creds, setCreds] = useState<RegisteredPatient | null>(null)
  const [copied, setCopied] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const ageFromDob = (dob: string): number => {
    if (!dob) return 0
    const birth = new Date(dob)
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    const m = now.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1
    return Math.max(age, 0)
  }

  const validate = (): Partial<Record<keyof FormState, string>> => {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) next.name = t('asha.errNameRequired')
    // Exactly 10 digits, digits only — the input itself strips anything else.
    if (!/^\d{10}$/.test(form.mobile)) next.mobile = t('asha.errPhoneRequired')
    if (!form.dob) next.dob = t('asha.errDobRequired')
    if (!form.gender) next.gender = t('asha.errGenderRequired')
    if (form.abhaId.trim().length < 4) next.abhaId = t('asha.errAbhaRequired')
    if (!form.village) next.village = t('asha.errVillageRequired')
    if (!form.ashaWorker) next.ashaWorker = t('asha.errWorkerRequired')
    return next
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (saved) return

    const found = validate()
    setErrors(found)
    if (Object.values(found).some(Boolean)) return

    setSaved(true)
    const village = villages.find((v) => v.id === form.village)?.name ?? ''
    const ashaWorkerName = ashaWorkers.find((w) => w.id === form.ashaWorker)?.name ?? ''
    try {
      const registered = await patientService.register({
        fullName: form.name.trim(),
        phone: form.mobile,
        dateOfBirth: form.dob,
        gender: form.gender as 'male' | 'female' | 'other',
        abhaId: form.abhaId.trim(),
        village,
        householdId: form.householdId.trim() || undefined,
        bloodGroup: form.bloodGroup || undefined,
        ashaWorker: ashaWorkerName || undefined,
        risk: form.risk,
        notes: form.notes.trim() || undefined,
      })

      addPatient({
        // The backend user id doubles as the local record id, so the two stay
        // linkable when the patient later logs in.
        id: registered.userId,
        beneficiaryId: registered.beneficiaryId,
        name: registered.fullName,
        abhaId: form.abhaId.trim(),
        age: ageFromDob(form.dob),
        gender: form.gender.charAt(0).toUpperCase() + form.gender.slice(1),
        bloodGroup: form.bloodGroup || '—',
        phone: `+91 ${form.mobile}`,
        address: form.householdId ? `Household ${form.householdId}, ${village}` : village,
        village,
        ward: NOT_RECORDED,
        householdId: form.householdId.trim() || undefined,
        risk: form.risk,
        riskReason: form.risk === 'high' || form.risk === 'medium' ? (form.notes.trim() || 'Under monitoring') : undefined,
        registeredAt: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        activeConditions: form.notes.trim() ? [form.notes.trim()] : [],
      })

      addToast('success', t('asha.patientSavedToast'))
      if (photo) {
        try {
          await beneficiaryService.uploadPhoto(registered.beneficiaryId, photo)
        } catch {
          addToast('error', t('photo.saveFailed'))
        }
      }
      setCreds(registered)
      setCopied(false)
    } catch (err) {
      addToast('error', apiErrorMessage(err, t('asha.errRegistration')))
      setSaved(false)
    }
  }

  const closeCredentials = () => {
    setCreds(null)
    navigate('/asha/patients')
  }

  const copyPassword = async () => {
    if (!creds) return
    try {
      await navigator.clipboard.writeText(creds.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (insecure context) — the password is still on screen.
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader title={t('asha.newPatientTitle')} subtitle={t('asha.newPatientSubtitle')} />

      <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
            <Icon name="users" size={20} className="text-primary" />
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.personalInfo')}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <div className="flex items-center gap-4 md:col-span-2 rounded-lg border border-outline-variant bg-surface-container-low p-4">
              <PhotoUploadField size="md" file={photo} onFileChange={setPhoto} onError={(msg) => addToast('error', msg)} />
              <div>
                <p className="font-label-md text-label-md text-on-surface">{t('photo.upload')}</p>
                <p className="font-caption text-caption text-on-surface-variant">
                  {t('photo.hint')} · {t('asha.photoAfterSave')}
                </p>
              </div>
            </div>
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
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'patient_name-error' : undefined}
                onChange={(e) => set('name', e.target.value)}
              />
              <div id="patient_name-error">
                <FieldError message={errors.name} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="uid">
                {t('asha.abhaId')} *
              </label>
              <input
                id="uid"
                className={inputCls}
                placeholder={t('asha.abhaPlaceholder')}
                required
                type="text"
                value={form.abhaId}
                aria-invalid={!!errors.abhaId}
                aria-describedby={errors.abhaId ? 'uid-error' : undefined}
                onChange={(e) => set('abhaId', e.target.value)}
              />
              <div id="uid-error">
                <FieldError message={errors.abhaId} />
              </div>
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
                  inputMode="numeric"
                  maxLength={10}
                  pattern="\d{10}"
                  placeholder={t('asha.mobilePlaceholder')}
                  required
                  type="tel"
                  value={form.mobile}
                  aria-invalid={!!errors.mobile}
                  aria-describedby={errors.mobile ? 'mobile-error' : undefined}
                  onChange={(e) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>
              <div id="mobile-error">
                <FieldError message={errors.mobile} />
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
                aria-invalid={!!errors.dob}
                aria-describedby={errors.dob ? 'dob-error' : undefined}
                onChange={(e) => set('dob', e.target.value)}
              />
              <div id="dob-error">
                <FieldError message={errors.dob} />
              </div>
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
              <div id="gender-error">
                <FieldError message={errors.gender} />
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
              <SearchableSelect
                id="village"
                label={`${t('asha.villageLocality')} *`}
                required
                options={villages.map((v) => ({ id: v.id, name: v.name, code: v.code }))}
                showCode
                value={form.village}
                onChange={(id) => set('village', id)}
                placeholder={t('asha.selectVillage')}
                loading={villagesLoading}
                loadingLabel={t('asha.loadingVillages')}
                emptyLabel={t('asha.selectVillage')}
              />
              <div id="village-error">
                <FieldError message={errors.village} />
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
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="blood_group">
                {t('asha.bloodGroupOptional')}
              </label>
              <div className="relative">
                <select
                  id="blood_group"
                  className={`${inputCls} appearance-none`}
                  value={form.bloodGroup}
                  onChange={(e) => set('bloodGroup', e.target.value)}
                >
                  <option value="">{t('asha.selectBloodGroup')}</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
                <span className={selectWrap}>
                  <Icon name="chevronDown" size={20} />
                </span>
              </div>
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
              <SearchableSelect
                id="asha_worker"
                label={`${t('asha.assignedAsha')} *`}
                required
                options={ashaWorkers.map((w) => ({ id: w.id, name: `${w.name}${w.village ? ` (${w.village})` : ''}` }))}
                value={form.ashaWorker}
                onChange={(id) => set('ashaWorker', id)}
                placeholder={t('asha.selectWorker')}
                emptyLabel={t('asha.selectWorker')}
              />
              <div id="asha_worker-error">
                <FieldError message={errors.ashaWorker} />
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

      {creds && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="credentials-title"
        >
          <ASHACard className="w-full max-w-lg">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <Icon name="checkCircle" size={22} />
                </span>
                <h2 id="credentials-title" className="font-headline-md text-headline-md font-semibold text-on-surface">
                  {t('asha.credentialsTitle')}
                </h2>
              </div>

              <p className="font-body-md text-body-md text-on-surface-variant">
                {t('asha.credentialsIntro', { name: creds.fullName })}
              </p>

              <div className="space-y-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    {t('asha.credentialsPhone')}
                  </span>
                  <span className="font-body-md text-body-md font-semibold text-on-surface">+91 {creds.phone}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    {t('asha.credentialsPassword')}
                  </span>
                  <span className="flex items-center gap-2">
                    <code className="rounded bg-surface-container-highest px-2 py-1 font-mono text-body-md font-semibold text-on-surface">
                      {creds.password}
                    </code>
                    <ASHAButton
                      variant="outline"
                      fullWidth={false}
                      label={copied ? t('asha.credentialsCopied') : t('asha.credentialsCopy')}
                      onClick={() => void copyPassword()}
                    />
                  </span>
                </div>
              </div>

              <p className="font-caption text-caption text-error">{t('asha.credentialsOnce')}</p>

              <ASHAButton
                variant="primary"
                fullWidth
                label={t('asha.credentialsDone')}
                onClick={closeCredentials}
              />
            </div>
          </ASHACard>
        </div>
      )}
    </div>
  )
}
