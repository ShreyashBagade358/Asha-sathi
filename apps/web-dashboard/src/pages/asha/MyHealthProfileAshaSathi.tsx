import { Link, useParams } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { useASHAStore } from '@/stores/asha.store'
import { Icon } from '@/components/common/Icons'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import type { RiskLevel } from '@/pages/asha/mockData'

const riskStyles: Record<RiskLevel, string> = {
  low: 'bg-secondary-container text-on-secondary-container',
  medium: 'bg-[#FF8C00]/15 text-[#B34E00]',
  high: 'bg-error-container text-on-error-container',
}

export default function MyHealthProfileAshaSathi() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const patients = useASHAStore((s) => s.patients)
  const { id } = useParams<{ id: string }>()

  const patient = patients.find((p) => p.id === id) ?? patients[1]

  const vitals = [
    { label: t('asha.height'), value: '170 cm', icon: 'activity' as const },
    { label: t('asha.weight'), value: '72 kg', icon: 'box' as const },
    { label: t('asha.bloodGroup'), value: patient.bloodGroup, icon: 'heart' as const, tone: 'error' },
    { label: t('asha.latestBp'), value: patient.risk === 'high' ? '145/90' : '120/80', icon: 'activity' as const, tone: 'error' },
  ]

  const sections: {
    title: string
    icon: 'fileText'
    tone: 'primary' | 'secondary' | 'tertiary'
    items: { name: string; meta: string; action?: 'download' }[]
  }[] = [
    {
      title: t('asha.medicalHistory'),
      icon: 'fileText' as const,
      tone: 'primary',
      items: [
        { name: 'Hypertension', meta: t('asha.diagnosed2021') },
        { name: 'Appendectomy', meta: t('asha.surgery2015') },
      ],
    },
    {
      title: t('asha.activePrescriptions'),
      icon: 'fileText' as const,
      tone: 'secondary',
      items: [{ name: 'Amlodipine 5mg', meta: t('asha.dailyDose') }],
    },
    {
      title: t('asha.recentLabReports'),
      icon: 'fileText' as const,
      tone: 'tertiary',
      items: [{ name: 'Lipid Profile', meta: '12 Oct 2023', action: 'download' as const }],
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Breadcrumbs
        items={[{ label: t('nav.ashaPatients'), to: '/asha/patients' }, { label: t('nav.healthProfile') }]}
      />

      <section className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card md:flex-row md:items-center">
        <span className={`absolute bottom-0 left-0 top-0 w-2 ${riskStyles[patient.risk].split(' ')[0]}`} />
        <div className="flex flex-1 items-center gap-4 pl-2">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-container font-headline-lg font-bold text-on-primary-container md:h-24 md:w-24">
            {patient.name.charAt(0)}
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-headline-lg text-headline-lg leading-none text-on-surface">{patient.name}</h1>
              {patient.risk === 'high' ? (
                <span className="flex items-center gap-1 rounded-full bg-error-container px-2.5 py-1 font-caption text-caption text-on-error-container">
                  <Icon name="alert" size={16} />
                  {t('asha.highBpMonitoring')}
                </span>
              ) : null}
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {patient.age} {t('asha.years')} • {patient.gender} • {t('asha.hhid', { id: '10452-A' })}
            </p>
            <p className="font-caption text-caption text-outline">{t('asha.lastUpdated')}</p>
          </div>
        </div>
        <div className="mt-1 shrink-0 md:mt-0">
          <button
            type="button"
            onClick={() => addToast('success', t('asha.healthIdToast'))}
            className="flex h-touch-target items-center justify-center gap-2 rounded-lg bg-primary px-5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
          >
            <Icon name="download" size={18} />
            {t('asha.downloadHealthId')}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {vitals.map((vital) => (
          <div
            key={vital.label}
            className={`relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-outline-variant p-4 text-center ${
              vital.tone === 'error' ? 'bg-error-container/30' : 'bg-surface-container-low'
            }`}
          >
            {vital.tone === 'error' ? <span className="absolute inset-0 bg-error opacity-5" /> : null}
            <Icon name={vital.icon} size={32} className={vital.tone === 'error' ? 'text-error' : 'text-outline'} />
            <span className={`font-caption text-caption uppercase tracking-wider ${vital.tone === 'error' ? 'text-error' : 'text-on-surface-variant'}`}>
              {vital.label}
            </span>
            <span className={`font-headline-md text-headline-md ${vital.tone === 'error' ? 'text-error' : 'text-on-surface'}`}>
              {vital.value}
            </span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="border-b border-outline-variant pb-1 font-headline-md text-headline-md font-semibold text-on-surface">
          {t('asha.recordsSummary')}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {sections.map((section) => (
            <div key={section.title} className="flex h-full flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
              <div className={`mb-1 flex items-center gap-2 ${section.tone === 'secondary' ? 'text-secondary' : section.tone === 'tertiary' ? 'text-tertiary' : 'text-primary'}`}>
                <Icon name={section.icon} size={20} />
                <h3 className="font-label-md text-label-md text-on-surface">{section.title}</h3>
              </div>
              <ul className="flex flex-1 flex-col gap-1">
                {section.items.map((item) => (
                  <li key={item.name} className="flex items-center justify-between border-b border-outline-variant pb-1 font-body-md text-body-md last:border-0 last:pb-0">
                    <div>
                      <p className="text-on-surface">{item.name}</p>
                      <p className="font-caption text-caption text-on-surface-variant">{item.meta}</p>
                    </div>
                    {item.action === 'download' ? (
                      <button
                        type="button"
                        aria-label={t('common.download')}
                        onClick={() => addToast('success', t('asha.downloadToast'))}
                        className="cursor-pointer text-primary transition-colors hover:text-on-primary-fixed-variant"
                      >
                        <Icon name="download" size={18} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => addToast('info', t('asha.viewAllToast'))}
                className="mt-auto rounded-lg border border-outline-variant py-2 text-center font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container"
              >
                {t('asha.viewAll')}
              </button>
            </div>
          ))}
        </div>
      </section>

      <Link
        to={`/asha/patients/${patient.id}`}
        className="flex h-touch-target items-center justify-center gap-2 rounded-full border border-outline font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-variant"
      >
        <Icon name="chevronLeft" size={18} />
        {t('asha.backToPatient')}
      </Link>
    </div>
  )
}
