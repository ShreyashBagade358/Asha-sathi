import { useLocalization } from '@/hooks/useLocalization'
import { usePatientProfile } from '@/hooks/usePatientProfile'
import { PageHeader } from '@/components/layout/PageHeader'
import { PatientHistoryTimeline } from '@/components/patient/PatientHistoryTimeline'

export default function PatientHealthRecordsPage() {
  const { t } = useLocalization()
  const profile = usePatientProfile()

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={t('patient.recordsTitle')} subtitle={t('patient.recordsSubtitle')} />

      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-card">
        <PatientHistoryTimeline beneficiaryId={profile.id} title={t('asha.medicalHistory')} />
      </section>
    </div>
  )
}
