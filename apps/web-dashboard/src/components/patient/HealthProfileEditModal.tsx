import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import {
  apiErrorMessage,
  patientService,
  type MyPatientProfile,
  type PatientProfileUpdatePayload,
} from '@/services/patient.service'
import { PROFILE_QUERY_KEY } from '@/hooks/usePatientProfile'

const inputCls =
  'h-touch-target w-full rounded-lg border border-outline bg-surface px-3 font-body-md text-body-md text-on-surface outline-none focus:border-primary'

type NumericKey =
  | 'heightCm'
  | 'weightKg'
  | 'bpSystolic'
  | 'bpDiastolic'
  | 'bloodSugarRandom'
  | 'waistCircumferenceCm'
  | 'hemoglobin'

type BooleanKey =
  | 'tobaccoUse'
  | 'alcoholUse'
  | 'familyHistoryDiabetes'
  | 'familyHistoryHypertension'
  | 'knownDiabetes'
  | 'knownHypertension'

const NUMERIC_FIELDS: NumericKey[] = [
  'heightCm',
  'weightKg',
  'bpSystolic',
  'bpDiastolic',
  'hemoglobin',
  'bloodSugarRandom',
  'waistCircumferenceCm',
]

const BOOLEAN_FIELDS: BooleanKey[] = [
  'tobaccoUse',
  'alcoholUse',
  'knownDiabetes',
  'knownHypertension',
  'familyHistoryDiabetes',
  'familyHistoryHypertension',
]

/** camel payload key → the snake_case key stored in `profile_inputs`. */
const INPUT_KEY: Record<string, string> = {
  heightCm: 'height_cm',
  weightKg: 'weight_kg',
  bpSystolic: 'bp_systolic',
  bpDiastolic: 'bp_diastolic',
  bloodSugarRandom: 'blood_sugar_random',
  waistCircumferenceCm: 'waist_circumference_cm',
  hemoglobin: 'hemoglobin',
  tobaccoUse: 'tobacco_use',
  alcoholUse: 'alcohol_use',
  physicalActivity: 'physical_activity',
  familyHistoryDiabetes: 'family_history_diabetes',
  familyHistoryHypertension: 'family_history_hypertension',
  knownDiabetes: 'known_diabetes',
  knownHypertension: 'known_hypertension',
}

type FormState = Record<NumericKey, string> & Record<BooleanKey, boolean | ''> & { physicalActivity: string }

const VITAL_KEYS = ['heightCm', 'weightKg', 'bpSystolic', 'bpDiastolic', 'hemoglobin'] as const
type VitalKey = (typeof VITAL_KEYS)[number]

function readInitial(profile: MyPatientProfile | undefined): FormState {
  const inputs = profile?.profileInputs ?? {}
  const vitals = profile?.vitals
  /** `vitals` only carries these five; the rest live in `profile_inputs` only. */
  const value = (key: NumericKey): string => {
    const fromInputs = inputs[INPUT_KEY[key]]
    const fromVitals = VITAL_KEYS.includes(key as VitalKey) ? vitals?.[key as VitalKey] : undefined
    const resolved = fromInputs ?? fromVitals
    return resolved == null ? '' : String(resolved)
  }
  const num = value
  const bool = (key: BooleanKey): boolean | '' => {
    const value = inputs[INPUT_KEY[key]]
    return typeof value === 'boolean' ? value : ''
  }
  return {
    heightCm: num('heightCm'),
    weightKg: num('weightKg'),
    bpSystolic: num('bpSystolic'),
    bpDiastolic: num('bpDiastolic'),
    bloodSugarRandom: num('bloodSugarRandom'),
    waistCircumferenceCm: num('waistCircumferenceCm'),
    hemoglobin: num('hemoglobin'),
    tobaccoUse: bool('tobaccoUse'),
    alcoholUse: bool('alcoholUse'),
    knownDiabetes: bool('knownDiabetes'),
    knownHypertension: bool('knownHypertension'),
    familyHistoryDiabetes: bool('familyHistoryDiabetes'),
    familyHistoryHypertension: bool('familyHistoryHypertension'),
    physicalActivity: typeof inputs.physical_activity === 'string' ? (inputs.physical_activity as string) : '',
  }
}

/** Only the fields the user actually changed — everything else stays put. */
function diff(initial: FormState, next: FormState): PatientProfileUpdatePayload {
  const payload: PatientProfileUpdatePayload = {}
  for (const key of NUMERIC_FIELDS) {
    const before = initial[key]
    const after = next[key].trim()
    if (after === before.trim()) continue
    if (after === '') continue
    const parsed = Number(after)
    if (Number.isNaN(parsed)) continue
    ;(payload as Record<string, unknown>)[key] = parsed
  }
  for (const key of BOOLEAN_FIELDS) {
    if (initial[key] === next[key]) continue
    if (next[key] === '') continue
    ;(payload as Record<string, unknown>)[key] = next[key]
  }
  if (initial.physicalActivity !== next.physicalActivity && next.physicalActivity) {
    payload.physicalActivity = next.physicalActivity as 'low' | 'moderate' | 'high'
  }
  return payload
}

/**
 * Editable screening inputs for the signed-in patient, saved through
 * `PUT /patients/me`. Empty numeric fields mean "leave unchanged", never
 * "clear" — the endpoint merges only the keys it is given.
 */
export function HealthProfileEditModal({
  open,
  profile,
  onClose,
}: {
  open: boolean
  profile: MyPatientProfile | undefined
  onClose: () => void
}) {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [initial, setInitial] = useState<FormState>(() => readInitial(profile))
  const [form, setForm] = useState<FormState>(() => readInitial(profile))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const snapshot = readInitial(profile)
    setInitial(snapshot)
    setForm(snapshot)
  }, [open, profile])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const setNum = (key: NumericKey, value: string) => setForm((prev) => ({ ...prev, [key]: value }))
  const setBool = (key: BooleanKey, value: boolean) =>
    setForm((prev) => ({ ...prev, [key]: prev[key] === value ? '' : value }))

  const save = async () => {
    const payload = diff(initial, form)
    if (Object.keys(payload).length === 0) {
      addToast('info', t('profileEdit.nothingToSave'))
      return
    }
    setSaving(true)
    try {
      const updated = await patientService.updateMyProfile(payload)
      await queryClient.cancelQueries({ queryKey: [PROFILE_QUERY_KEY] })
      queryClient.setQueryData([PROFILE_QUERY_KEY], updated)
      void queryClient.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: ['ai', 'predictions'] })
      addToast('success', t('profileEdit.saved'))
      onClose()
    } catch (err) {
      addToast('error', `${t('profileEdit.saveFailed')}: ${apiErrorMessage(err, '')}`.replace(/: $/, ''))
    } finally {
      setSaving(false)
    }
  }

  const numeric = (key: NumericKey, label: string, step = '0.1') => (
    <label className="flex flex-col gap-1">
      <span className="font-caption text-caption text-on-surface-variant">{label}</span>
      <input
        className={inputCls}
        type="number"
        inputMode="decimal"
        step={step}
        value={form[key]}
        onChange={(e) => setNum(key, e.target.value)}
      />
    </label>
  )

  const toggle = (key: BooleanKey, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setBool(key, true)}
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left font-body-md text-body-md transition-colors ${
        form[key] === true
          ? 'border-error bg-error-container/40 text-on-surface'
          : form[key] === false
            ? 'border-outline bg-surface text-on-surface'
            : 'border-dashed border-outline-variant bg-surface-container text-on-surface-variant'
      }`}
    >
      <span>{label}</span>
      <span className="font-caption text-caption">
        {form[key] === true ? t('common.yes') : form[key] === false ? t('common.no') : '—'}
      </span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5" role="dialog" aria-modal="true" aria-label={t('profileEdit.title')}>
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-outline-variant px-5 py-4">
          <div>
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('profileEdit.title')}</h2>
            <p className="font-caption text-caption text-on-surface-variant">{t('profileEdit.subtitle')}</p>
          </div>
          <button
            type="button"
            aria-label={t('common.cancel')}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="mb-2 font-label-md text-label-md font-semibold text-on-surface">{t('profileEdit.vitals')}</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {numeric('heightCm', t('profileEdit.height'))}
              {numeric('weightKg', t('profileEdit.weight'))}
              {numeric('waistCircumferenceCm', t('profileEdit.waist'), '1')}
              {numeric('bpSystolic', t('profileEdit.systolic'), '1')}
              {numeric('bpDiastolic', t('profileEdit.diastolic'), '1')}
              {numeric('hemoglobin', t('profileEdit.haemoglobin'))}
              {numeric('bloodSugarRandom', t('profileEdit.bloodSugar'), '1')}
            </div>
          </section>

          <section>
            <h3 className="mb-2 font-label-md text-label-md font-semibold text-on-surface">{t('profileEdit.lifestyle')}</h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {BOOLEAN_FIELDS.map((key) => toggle(key, t(LABEL_KEY[key])))}
            </div>

            <label className="mt-3 flex flex-col gap-1">
              <span className="font-caption text-caption text-on-surface-variant">{t('profileEdit.activity')}</span>
              <select
                className={inputCls}
                value={form.physicalActivity}
                onChange={(e) => setForm((prev) => ({ ...prev, physicalActivity: e.target.value }))}
              >
                <option value="">—</option>
                <option value="low">{t('profileEdit.activityLow')}</option>
                <option value="moderate">{t('profileEdit.activityModerate')}</option>
                <option value="high">{t('profileEdit.activityHigh')}</option>
              </select>
            </label>
          </section>
        </div>

        <footer className="flex justify-end gap-3 border-t border-outline-variant px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-outline px-5 py-2 font-label-md text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-label-md text-label-md font-semibold text-on-primary transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[18px] ${saving ? 'animate-spin' : ''}`}>
              {saving ? 'progress_activity' : 'save'}
            </span>
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </footer>
      </div>
    </div>
  )
}

const LABEL_KEY: Record<BooleanKey, string> = {
  tobaccoUse: 'profileEdit.tobacco',
  alcoholUse: 'profileEdit.alcohol',
  knownDiabetes: 'profileEdit.knownDiabetes',
  knownHypertension: 'profileEdit.knownHypertension',
  familyHistoryDiabetes: 'profileEdit.familyDiabetes',
  familyHistoryHypertension: 'profileEdit.familyHypertension',
}
