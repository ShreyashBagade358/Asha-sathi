import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { useAuth } from '@/hooks/useAuth'
import { useAppStore } from '@/stores/app.store'
import { useUIStore } from '@/stores/ui.store'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { getErrorMessage } from '@/components/common/ErrorState'
import { referralService } from '@/services/referral.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import type { ReferralRecord, ReferralStatus, ReferralUrgency } from '@/pages/asha/mockData'

const STATUS_META: Record<ReferralStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-tertiary-container text-on-tertiary-container' },
  accepted: { label: 'Accepted', className: 'bg-secondary-container text-on-secondary-container' },
  completed: { label: 'Completed', className: 'bg-secondary-container text-on-secondary-container' },
  cancelled: { label: 'Cancelled', className: 'bg-surface-variant text-on-surface-variant' },
}

const URGENCY_TONE: Record<ReferralUrgency, { label: string; className: string }> = {
  emergency: { label: 'Emergency', className: 'bg-error-container text-on-error-container' },
  urgent: { label: 'Urgent', className: 'bg-error-container text-on-error-container' },
  routine: { label: 'Routine', className: 'bg-surface-variant text-on-surface-variant' },
}

export default function ReferralAshaSathi() {
  const { t } = useLocalization()
  const { user } = useAuth()
  const { addToast } = useUIStore()
  const referrals = useAppStore((s) => s.referrals)
  const addReferral = useAppStore((s) => s.addReferral)
  const [filter, setFilter] = useState<'all' | ReferralStatus>('all')
  const [showForm, setShowForm] = useState(false)

  const beneficiariesQuery = useQuery({
    queryKey: ['beneficiaries', 'all'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })
  const beneficiaryOptions = beneficiariesQuery.data?.items ?? []

  const [form, setForm] = useState({
    beneficiaryId: '',
    patientName: '',
    age: '',
    fromFacility: '',
    toFacility: '',
    reason: '',
    urgency: 'routine' as ReferralUrgency,
  })

  const setField = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const submitMutation = useMutation({
    mutationFn: (snapshot: typeof form) =>
      referralService.createReferral({
        beneficiaryId: snapshot.beneficiaryId,
        referralType: 'general',
        urgency: snapshot.urgency,
        reason: snapshot.reason.trim() || undefined,
        referredTo: snapshot.toFacility.trim(),
        referredFrom: snapshot.fromFacility.trim() || user?.phcName || undefined,
      }),
    onSuccess: (created, snapshot) => {
      const ben = beneficiaryOptions.find((b) => b.id === snapshot.beneficiaryId)
      const record: ReferralRecord = {
        id: created.id,
        patientName: snapshot.patientName.trim() || ben?.name || '—',
        age: Number(snapshot.age) || 0,
        fromFacility: snapshot.fromFacility.trim() || user?.phcName || t('asha.refFromUnspecified'),
        toFacility: snapshot.toFacility.trim(),
        reason: snapshot.reason.trim() || t('asha.refReasonUnspecified'),
        urgency: snapshot.urgency,
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        status: 'pending',
        referredBy: user ? `${user.fullName} (ASHA)` : t('asha.refReferredByUnknown'),
      }
      addReferral(record)
      addToast('success', t('asha.referralCreated'))
      setShowForm(false)
      setForm({ beneficiaryId: '', patientName: '', age: '', fromFacility: '', toFacility: '', reason: '', urgency: 'routine' })
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.beneficiaryId || !form.toFacility.trim() || submitMutation.isPending) return
    submitMutation.mutate({ ...form })
  }

  const visible = referrals.filter((r) => (filter === 'all' ? true : r.status === filter))

  const tabs: { key: 'all' | ReferralStatus; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: referrals.length },
    { key: 'pending', label: t('asha.refPending'), count: referrals.filter((r) => r.status === 'pending').length },
    { key: 'accepted', label: t('asha.refAccepted'), count: referrals.filter((r) => r.status === 'accepted').length },
    { key: 'completed', label: t('asha.refCompleted'), count: referrals.filter((r) => r.status === 'completed').length },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('asha.referralTitle')}
        subtitle={t('asha.referralSubtitle')}
        breadcrumbs={[{ label: t('nav.ashaHome'), to: '/asha/home' }, { label: t('asha.referralTitle') }]}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98]"
          >
            <Icon name="plus" size={18} />
            {showForm ? t('asha.closeForm') : t('asha.newReferral')}
          </button>
        }
      />

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-primary-fixed-dim bg-surface-container-lowest p-4 shadow-card"
        >
          <h2 className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.newReferral')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select value={form.beneficiaryId} onChange={(e) => setField('beneficiaryId', e.target.value)} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" required>
              <option value="" disabled>
                {t('asha.selectPatient')}
              </option>
              {beneficiaryOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.village ? ` · ${b.village}` : ''}
                </option>
              ))}
            </select>
            <input value={form.patientName} onChange={(e) => setField('patientName', e.target.value)} placeholder={t('asha.formPatientName')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <input value={form.age} onChange={(e) => setField('age', e.target.value)} placeholder={t('asha.formAge')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" />
            <input value={form.fromFacility} onChange={(e) => setField('fromFacility', e.target.value)} placeholder={t('asha.formFromFacility')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <input value={form.toFacility} onChange={(e) => setField('toFacility', e.target.value)} placeholder={t('asha.formToFacility')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" required />
            <select value={form.urgency} onChange={(e) => setField('urgency', e.target.value)} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="routine">{t('asha.refUrgencyRoutine')}</option>
              <option value="urgent">{t('asha.refUrgencyUrgent')}</option>
              <option value="emergency">{t('asha.refUrgencyEmergency')}</option>
            </select>
            <input value={form.reason} onChange={(e) => setField('reason', e.target.value)} placeholder={t('asha.formReason')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="h-touch-target rounded-full border border-outline px-5 py-2.5 font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container">
              {t('asha.cancel')}
            </button>
            <button type="submit" disabled={submitMutation.isPending} className="h-touch-target rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary hover:bg-on-primary-fixed-variant disabled:opacity-60">
              {t('asha.createReferral')}
            </button>
          </div>
        </form>
      ) : null}

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
              className={`rounded-full px-1.5 text-[11px] font-bold leading-4 ${
                filter === tab.key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-variant text-on-surface-variant'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {visible.map((ref) => {
          const statusMeta = STATUS_META[ref.status]
          const urgencyMeta = URGENCY_TONE[ref.urgency]
          return (
            <div
              key={ref.id}
              className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card"
            >
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                    <Icon name="edit" size={22} />
                  </span>
                  <div>
                    <p className="font-label-md text-label-md font-semibold text-on-surface">{ref.patientName}</p>
                    <p className="font-caption text-caption text-on-surface-variant">
                      {ref.age} yrs · {ref.referredBy}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${urgencyMeta.className}`}>
                    {urgencyMeta.label}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-3">
                <div className="flex items-center gap-2 font-body-md text-body-md text-on-surface">
                  <Icon name="mapPin" size={16} className="text-primary" />
                  <span className="text-on-surface-variant">{t('asha.refFrom')}:</span>
                  {ref.fromFacility}
                </div>
                <div className="flex items-center gap-2 font-body-md text-body-md text-on-surface">
                  <Icon name="chevronRight" size={16} className="text-primary" />
                  <span className="text-on-surface-variant">{t('asha.refTo')}:</span>
                  {ref.toFacility}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="min-w-0 flex-1 truncate font-caption text-caption text-on-surface-variant">{ref.reason}</p>
                <span className="shrink-0 font-caption text-caption text-on-surface-variant">
                  <Icon name="calendar" size={14} className="mr-1 inline" />
                  {ref.date}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
