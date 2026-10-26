import { useEffect, useState } from 'react'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { patientService, type ReferralRequest } from '@/services/patient.service'

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'patient.refPending', className: 'bg-tertiary-container text-on-tertiary-container' },
  accepted: { label: 'patient.refAccepted', className: 'bg-secondary-container text-on-secondary-container' },
  completed: { label: 'patient.refCompleted', className: 'bg-secondary-container text-on-secondary-container' },
  cancelled: { label: 'patient.refCancelled', className: 'bg-surface-variant text-on-surface-variant' },
}

const URGENCY_META: Record<string, { label: string; className: string }> = {
  emergency: { label: 'patient.emergency', className: 'bg-error-container text-on-error-container' },
  urgent: { label: 'patient.urgent', className: 'bg-error-container text-on-error-container' },
  routine: { label: 'patient.routine', className: 'bg-surface-variant text-on-surface-variant' },
}

const REFERRAL_TYPES = [
  { value: 'general', label: 'General Medicine' },
  { value: 'specialist', label: 'Specialist Review' },
  { value: 'maternal', label: 'Maternal / Obstetric' },
  { value: 'child', label: 'Child Health' },
  { value: 'emergency', label: 'Emergency / Trauma' },
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PatientReferralsPage() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()

  const [referrals, setReferrals] = useState<ReferralRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | string>('all')

  // Request Referral modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [refType, setRefType] = useState('')
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setReferrals(await patientService.listReferralRequests())
    } catch {
      setReferrals([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const visible = referrals.filter((r) => (filter === 'all' ? true : r.status === filter))

  const tabs: { key: string; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: referrals.length },
    { key: 'pending', label: t('patient.refPending'), count: referrals.filter((r) => r.status === 'pending').length },
    { key: 'accepted', label: t('patient.refAccepted'), count: referrals.filter((r) => r.status === 'accepted').length },
    { key: 'completed', label: t('patient.refCompleted'), count: referrals.filter((r) => r.status === 'completed').length },
  ]

  const submitReferral = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!refType || !reason.trim()) {
      setFormError('Please select a type and enter a reason.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await patientService.createReferralRequest({
        referralType: refType,
        urgency,
        reason: reason.trim(),
      })
      addToast('success', t('patient.referralToast'))
      setModalOpen(false)
      setRefType('')
      setUrgency('routine')
      setReason('')
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit referral request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('patient.referralsTitle')}
        subtitle={t('patient.referralsSubtitle')}
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98]"
          >
            <Icon name="plus" size={18} />
            {t('patient.requestReferral')}
          </button>
        }
      />

      {/* Request Referral modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
              {t('patient.requestReferral')}
            </h2>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
              Request a referral to a higher health facility.
            </p>

            <form className="mt-5 flex flex-col gap-4" onSubmit={submitReferral}>
              <div>
                <label className="font-label-md text-label-md font-semibold text-on-surface">
                  Referral Type *
                </label>
                <select
                  value={refType}
                  onChange={(e) => { setRefType(e.target.value); setFormError(null) }}
                  className="mt-1.5 h-12 w-full rounded-lg border border-outline bg-surface px-3 font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none"
                >
                  <option value="">Select type...</option>
                  {REFERRAL_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-label-md text-label-md font-semibold text-on-surface">
                  {t('patient.urgency')}
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {(['routine', 'urgent', 'emergency'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUrgency(u)}
                      className={`h-11 rounded-lg font-label-md text-label-md font-semibold transition-colors ${
                        urgency === u
                          ? 'bg-primary text-on-primary'
                          : 'border border-outline bg-surface text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {t(`patient.${u}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-label-md text-label-md font-semibold text-on-surface">
                  {t('patient.refReason')} *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setFormError(null) }}
                  rows={3}
                  placeholder="Describe your symptoms or reason for referral..."
                  className="mt-1.5 w-full rounded-lg border border-outline bg-surface px-3 py-2 font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none"
                />
              </div>

              {formError ? (
                <p className="font-caption text-caption text-error">{formError}</p>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-full border border-outline px-4 py-2.5 font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" />
                  ) : (
                    <Icon name="plus" size={18} />
                  )}
                  {t('patient.requestReferral')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md font-semibold transition-colors ${
              filter === tab.key
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 text-label-sm font-bold leading-4 ${
                filter === tab.key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-variant text-on-surface-variant'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
          Loading referrals…
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
          {t('patient.noReferrals')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((referral) => {
            const statusMeta = STATUS_META[referral.status] ?? STATUS_META.pending
            const urgencyMeta = URGENCY_META[referral.urgency] ?? URGENCY_META.routine
            return (
              <div key={referral.id} className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                      <Icon name="activity" size={22} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-label-md text-label-md font-semibold text-on-surface">
                        {t('patient.refTo')}: {referral.referral_type}
                      </p>
                      <p className="font-caption text-caption text-on-surface-variant">
                        {formatDate(referral.created_at)} · {t('patient.referredBy')}: {referral.asha_worker_name ?? '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${urgencyMeta.className}`}>
                      {t(urgencyMeta.label)}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${statusMeta.className}`}>
                      {t(statusMeta.label)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-3">
                  <p className="font-caption text-caption text-on-surface-variant">{t('patient.refReason')}</p>
                  <p className="font-body-md text-body-md font-medium text-on-surface">{referral.reason}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
