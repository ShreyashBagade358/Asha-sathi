import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { patientService } from '@/services/patient.service'
import { PROFILE_QUERY_KEY } from '@/hooks/usePatientProfile'

const inputCls =
  'h-touch-target w-full rounded-lg border border-outline bg-surface px-3 font-body-md text-body-md text-on-surface outline-none focus:border-primary'

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * "Report Pregnancy" — the patient-initiated pregnancy registration.
 * Shown on the health-profile page to female patients with no ongoing
 * pregnancy. LMP is the only clinical input; EDD is derived server-side.
 * On success the ASHA worker is notified and the profile query is
 * invalidated so the pregnancy summary appears immediately.
 */
export function ReportPregnancyModal({ open, onClose }: Props) {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()

  const [lmp, setLmp] = useState('')
  const [gravida, setGravida] = useState('')
  const [parity, setParity] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!lmp) {
      setError(t('patient.reportPregnancyLmpRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await patientService.createMyPregnancy({
        lmp,
        gravida: gravida ? Number(gravida) : undefined,
        parity: parity ? Number(parity) : undefined,
        notes: notes.trim() || undefined,
      })
      addToast('success', t('patient.reportPregnancySuccess'))
      await queryClient.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY] })
      onClose()
      // Reset for next time.
      setLmp('')
      setGravida('')
      setParity('')
      setNotes('')
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.errorMsg')
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  // LMP cannot be in the future.
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5" role="dialog" aria-modal="true" aria-label={t('patient.reportPregnancy')}>
      <form
        onSubmit={submit}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-outline-variant px-5 py-4">
          <div>
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('patient.reportPregnancy')}</h2>
            <p className="mt-0.5 font-caption text-caption text-on-surface-variant">{t('patient.reportPregnancySubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1">
            <span className="font-caption text-caption text-on-surface-variant">
              {t('patient.lmp')} <span className="text-error">*</span>
            </span>
            <input
              className={inputCls}
              type="date"
              max={today}
              value={lmp}
              onChange={(e) => setLmp(e.target.value)}
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-caption text-caption text-on-surface-variant">{t('patient.gravida')}</span>
              <input
                className={inputCls}
                type="number"
                min={0}
                max={20}
                inputMode="numeric"
                value={gravida}
                onChange={(e) => setGravida(e.target.value)}
                placeholder="—"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-caption text-caption text-on-surface-variant">{t('patient.parity')}</span>
              <input
                className={inputCls}
                type="number"
                min={0}
                max={20}
                inputMode="numeric"
                value={parity}
                onChange={(e) => setParity(e.target.value)}
                placeholder="—"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-caption text-caption text-on-surface-variant">{t('patient.notes')}</span>
            <textarea
              className={`${inputCls} h-20 resize-none py-2`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('patient.reportPregnancyNotesPlaceholder')}
            />
          </label>

          {error ? <p className="font-caption text-caption text-error">{error}</p> : null}
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
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-label-md text-label-md font-semibold text-on-primary transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[18px] ${saving ? 'animate-spin' : ''}`}>
              {saving ? 'progress_activity' : 'favorite'}
            </span>
            {saving ? t('common.loading') : t('patient.reportPregnancy')}
          </button>
        </footer>
      </form>
    </div>
  )
}
