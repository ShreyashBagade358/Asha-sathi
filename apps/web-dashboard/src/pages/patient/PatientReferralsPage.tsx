import { useState } from 'react'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { useAppStore, patientPortalProfile } from '@/stores/app.store'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import type { PatientReferralStatus, PatientReferralUrgency } from '@/pages/patient/mockData'

const STATUS_META: Record<PatientReferralStatus, { label: string; className: string }> = {
  pending: { label: 'patient.refPending', className: 'bg-tertiary-container text-on-tertiary-container' },
  accepted: { label: 'patient.refAccepted', className: 'bg-secondary-container text-on-secondary-container' },
  completed: { label: 'patient.refCompleted', className: 'bg-secondary-container text-on-secondary-container' },
  cancelled: { label: 'patient.refCancelled', className: 'bg-surface-variant text-on-surface-variant' },
}

const URGENCY_META: Record<PatientReferralUrgency, { label: string; className: string }> = {
  emergency: { label: 'patient.emergency', className: 'bg-error-container text-on-error-container' },
  urgent: { label: 'patient.urgent', className: 'bg-error-container text-on-error-container' },
  routine: { label: 'patient.routine', className: 'bg-surface-variant text-on-surface-variant' },
}

export default function PatientReferralsPage() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const referrals = useAppStore((s) => s.referrals)
  const patients = useAppStore((s) => s.patients)
  const [filter, setFilter] = useState<'all' | PatientReferralStatus>('all')

  const profile = patientPortalProfile(patients)
  const myReferrals = referrals.filter((r) => r.patientName === profile.name)

  const visible = myReferrals.filter((r) => (filter === 'all' ? true : r.status === filter))

  const tabs: { key: 'all' | PatientReferralStatus; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: myReferrals.length },
    { key: 'pending', label: t('patient.refPending'), count: myReferrals.filter((r) => r.status === 'pending').length },
    { key: 'accepted', label: t('patient.refAccepted'), count: myReferrals.filter((r) => r.status === 'accepted').length },
    { key: 'completed', label: t('patient.refCompleted'), count: myReferrals.filter((r) => r.status === 'completed').length },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('patient.referralsTitle')}
        subtitle={t('patient.referralsSubtitle')}
        breadcrumbs={[{ label: t('patient.referralsTitle') }]}
        actions={
          <button
            type="button"
            onClick={() => addToast('success', t('patient.referralToast'))}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98]"
          >
            <Icon name="plus" size={18} />
            {t('patient.requestReferral')}
          </button>
        }
      />

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

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
          {t('patient.noReferrals')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((referral) => {
            const statusMeta = STATUS_META[referral.status]
            const urgencyMeta = URGENCY_META[referral.urgency]
            return (
              <div key={referral.id} className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                      <Icon name="activity" size={22} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-label-md text-label-md font-semibold text-on-surface">{t('patient.refTo')}: {referral.toFacility}</p>
                      <p className="font-caption text-caption text-on-surface-variant">
                        {referral.date} · {t('patient.referredBy')}: {referral.referredBy}
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
