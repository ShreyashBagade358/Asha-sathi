import { useState } from 'react'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { useAppStore, patientPortalProfile } from '@/stores/app.store'
import { Icon, type IconName } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import type { HealthRecordCategory } from '@/pages/patient/mockData'

type TabKey = 'all' | HealthRecordCategory

const TAB_META: Record<HealthRecordCategory, { label: string; icon: IconName; tone: string }> = {
  checkup: { label: 'patient.tabCheckups', icon: 'activity', tone: 'bg-primary-container text-on-primary-container' },
  prescription: { label: 'patient.tabPrescriptions', icon: 'edit', tone: 'bg-secondary-container text-on-secondary-container' },
  lab: { label: 'patient.tabLabReports', icon: 'fileText', tone: 'bg-tertiary-container text-on-tertiary-container' },
}

export default function PatientHealthRecordsPage() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const healthRecords = useAppStore((s) => s.healthRecords)
  const pregnancies = useAppStore((s) => s.pregnancies)
  const children = useAppStore((s) => s.children)
  const patients = useAppStore((s) => s.patients)
  const [filter, setFilter] = useState<TabKey>('all')

  const profile = patientPortalProfile(patients)
  const pregnancy = pregnancies.find((p) => p.patientName === profile.name)
  const childRecords = children.filter((c) => c.village === profile.village)

  const visible = healthRecords.filter((r) => (filter === 'all' ? true : r.category === filter))

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: healthRecords.length },
    { key: 'checkup', label: t('patient.tabCheckups'), count: healthRecords.filter((r) => r.category === 'checkup').length },
    { key: 'prescription', label: t('patient.tabPrescriptions'), count: healthRecords.filter((r) => r.category === 'prescription').length },
    { key: 'lab', label: t('patient.tabLabReports'), count: healthRecords.filter((r) => r.category === 'lab').length },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('patient.recordsTitle')}
        subtitle={t('patient.recordsSubtitle')}
        breadcrumbs={[{ label: t('patient.recordsTitle') }]}
      />

      {pregnancy || childRecords.length > 0 ? (
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {pregnancy ? (
            <div className="rounded-2xl border border-primary/20 bg-primary-container/30 p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Icon name="heart" size={18} />
                <span className="font-label-md text-label-md font-semibold">{t('patient.pregnancySummary')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <p className="font-caption text-caption text-on-surface-variant">{t('patient.trimester')}</p>
                  <p className="font-label-md text-label-md font-semibold text-on-surface">{pregnancy.trimester}</p>
                </div>
                <div>
                  <p className="font-caption text-caption text-on-surface-variant">{t('patient.week')}</p>
                  <p className="font-label-md text-label-md font-semibold text-on-surface">{pregnancy.week}</p>
                </div>
                <div>
                  <p className="font-caption text-caption text-on-surface-variant">{t('patient.edd')}</p>
                  <p className="font-label-md text-label-md font-semibold text-on-surface">{pregnancy.edd}</p>
                </div>
                <div>
                  <p className="font-caption text-caption text-on-surface-variant">{t('patient.ancVisits')}</p>
                  <p className="font-label-md text-label-md font-semibold text-on-surface">{pregnancy.ancVisits}</p>
                </div>
                <div>
                  <p className="font-caption text-caption text-on-surface-variant">{t('patient.lmp')}</p>
                  <p className="font-label-md text-label-md font-semibold text-on-surface">{pregnancy.lmp}</p>
                </div>
                <div>
                  <p className="font-caption text-caption text-on-surface-variant">{t('asha.riskHighLabel')}</p>
                  <p className="font-label-md text-label-md font-semibold text-on-surface">{pregnancy.risk}</p>
                </div>
              </div>
            </div>
          ) : null}

          {childRecords.length > 0 ? (
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2 text-secondary">
                <Icon name="heart" size={18} />
                <span className="font-label-md text-label-md font-semibold">{t('asha.childHealthTitle')}</span>
              </div>
              <div className="flex flex-col gap-2">
                {childRecords.map((child) => (
                  <div key={child.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-label-md text-label-md font-semibold text-on-surface">{child.name}</p>
                      <p className="font-caption text-caption text-on-surface-variant">
                        {child.ageMonths} {t('patient.months')} · {child.gender}
                      </p>
                    </div>
                    <span className="shrink-0 font-caption text-caption font-semibold text-on-surface-variant">
                      {child.immunizationDone}/{child.immunizationTotal} {t('asha.immunization')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
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

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
          {t('patient.noRecords')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((record) => {
            const meta = TAB_META[record.category]
            return (
              <div
                key={record.id}
                className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card"
              >
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                      <Icon name={meta.icon} size={22} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-label-md text-label-md font-semibold text-on-surface">{record.title}</p>
                      <p className="font-caption text-caption text-on-surface-variant">
                        {record.date} · {record.facility}
                        {record.doctor ? ` · ${record.doctor}` : ''}
                      </p>
                    </div>
                  </div>
                  {record.downloadable ? (
                    <button
                      type="button"
                      aria-label={t('common.download')}
                      onClick={() => addToast('success', t('patient.reportDownloadedToast'))}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary transition-all hover:bg-surface-container active:scale-90"
                    >
                      <Icon name="download" size={20} />
                    </button>
                  ) : null}
                </div>

                {record.details.length > 0 ? (
                  <div className="grid grid-cols-2 gap-px border-t border-outline-variant/40 bg-surface-container-low/50 sm:grid-cols-3">
                    {record.details.map((detail) => (
                      <div key={detail.label} className="bg-surface-container-lowest px-4 py-3">
                        <p className="font-caption text-caption uppercase tracking-wider text-on-surface-variant">{detail.label}</p>
                        <p className="mt-0.5 font-body-md text-body-md font-semibold text-on-surface">{detail.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {record.dose ? (
                  <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-3">
                    <p className="font-caption text-caption text-on-surface-variant">
                      {t('patient.prescriptionDose')}: <span className="font-semibold text-on-surface">{record.dose}</span>
                    </p>
                    {record.duration ? (
                      <p className="font-caption text-caption text-on-surface-variant">
                        {t('patient.prescriptionDuration')}: <span className="font-semibold text-on-surface">{record.duration}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
