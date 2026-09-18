import { Link } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { useAppStore, patientPortalProfile } from '@/stores/app.store'
import { Icon, type IconName } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'

interface Vital {
  label: string
  value: string
  icon: IconName
  tone: 'error' | 'default'
}

export default function PatientHealthProfilePage() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const patients = useAppStore((s) => s.patients)

  const profile = patientPortalProfile(patients)

  const VITALS: Vital[] = [
    { label: 'patient.height', value: profile.height, icon: 'activity', tone: 'default' },
    { label: 'patient.weight', value: profile.weight, icon: 'box', tone: 'default' },
    { label: 'patient.latestBp', value: profile.latestBp, icon: 'activity', tone: 'error' },
    { label: 'patient.haemoglobin', value: profile.haemoglobin, icon: 'heart', tone: 'error' },
  ]

  const personalRows = [
    { label: t('patient.abhaId'), value: profile.abhaId },
    { label: t('patient.dob'), value: profile.dob },
    { label: t('patient.age'), value: `${profile.age} ${t('patient.years')}` },
    { label: t('patient.gender'), value: profile.gender },
    { label: t('patient.bloodGroup'), value: profile.bloodGroup },
    { label: t('patient.phoneNumber'), value: profile.phone },
    { label: t('patient.address'), value: profile.address },
    { label: t('patient.assignedPhc'), value: profile.phc },
    { label: t('patient.assignedAsha'), value: profile.ashaWorker },
  ]

  const pregnancyRows = [
    { label: t('patient.trimester'), value: `3rd` },
    { label: t('patient.week'), value: String(profile.week) },
    { label: t('patient.lmp'), value: profile.lmp },
    { label: t('patient.edd'), value: profile.edd },
    { label: t('patient.ancVisits'), value: String(profile.ancVisits) },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title={t('patient.healthProfileTitle')}
        subtitle={t('patient.healthProfileSubtitle')}
        breadcrumbs={[{ label: t('patient.healthProfileTitle') }]}
        actions={
          <button
            type="button"
            onClick={() => addToast('info', t('patient.profileEditToast'))}
            className="flex items-center gap-2 rounded-full border border-outline px-5 py-2.5 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container"
          >
            <Icon name="edit" size={18} />
            {t('patient.editProfile')}
          </button>
        }
      />

      <section className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-card md:flex-row md:items-center">
        <span className="absolute bottom-0 left-0 top-0 w-2 bg-error" />
        <div className="flex flex-1 items-center gap-4 pl-2">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-container font-headline-lg font-bold text-on-primary-container md:h-24 md:w-24">
            {profile.name.charAt(0)}
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-headline-lg text-headline-lg leading-none text-on-surface">{profile.name}</h1>
              {profile.highRisk ? (
                <span className="flex items-center gap-1 rounded-full bg-error-container px-2.5 py-1 font-caption text-caption text-on-error-container">
                  <Icon name="alert" size={16} />
                  {t('asha.highRiskLabel')}
                </span>
              ) : null}
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {profile.age} {t('patient.years')} · {profile.gender} · {profile.abhaId}
            </p>
            <p className="font-caption text-caption text-outline">
              {t('common.village')}: {profile.village}
            </p>
          </div>
        </div>
        <div className="mt-1 shrink-0 md:mt-0">
          <button
            type="button"
            onClick={() => addToast('success', t('patient.healthIdToast'))}
            className="flex h-touch-target items-center justify-center gap-2 rounded-lg bg-primary px-5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
          >
            <Icon name="download" size={18} />
            {t('patient.downloadHealthId')}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {VITALS.map((vital) => (
          <div
            key={vital.label}
            className={`relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-outline-variant/40 p-4 text-center ${
              vital.tone === 'error' ? 'bg-error-container/30' : 'bg-surface-container-low'
            }`}
          >
            {vital.tone === 'error' ? <span className="absolute inset-0 bg-error opacity-5" /> : null}
            <Icon name={vital.icon} size={32} className={vital.tone === 'error' ? 'text-error' : 'text-outline'} />
            <span className={`font-caption text-caption uppercase tracking-wider ${vital.tone === 'error' ? 'text-error' : 'text-on-surface-variant'}`}>
              {t(vital.label)}
            </span>
            <span className={`font-headline-md text-headline-md ${vital.tone === 'error' ? 'text-error' : 'text-on-surface'}`}>
              {vital.value}
            </span>
          </div>
        ))}
      </section>

      {profile.pregnant ? (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-headline-md text-headline-md font-semibold text-on-surface">
            <Icon name="heart" size={20} className="text-primary" />
            {t('patient.pregnancySummary')}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {pregnancyRows.map((row) => (
              <div key={row.label} className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card">
                <p className="font-caption text-caption uppercase tracking-wider text-on-surface-variant">{row.label}</p>
                <p className="mt-1 font-headline-md text-headline-md font-semibold text-on-surface">{row.value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">{t('patient.personalDetails')}</h2>
          <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card">
            {personalRows.map((row, i) => (
              <div
                key={row.label}
                className={`flex items-center justify-between gap-4 px-4 py-3 ${
                  i < personalRows.length - 1 ? 'border-b border-outline-variant' : ''
                }`}
              >
                <span className="font-caption text-caption text-on-surface-variant">{row.label}</span>
                <span className="truncate text-right font-body-md text-body-md font-medium text-on-surface">{row.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">{t('patient.activeConditions')}</h2>
          {profile.activeConditions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {profile.activeConditions.map((condition) => (
                <div
                  key={condition}
                  className="flex items-center gap-3 rounded-2xl border border-error/20 bg-error-container/40 p-4 shadow-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-container text-on-error-container">
                    <Icon name="alert" size={20} />
                  </span>
                  <p className="font-label-md text-label-md font-semibold text-on-error-container">{condition}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
              {t('patient.noConditions')}
            </p>
          )}

          <div className="mt-6">
            <h3 className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">{t('patient.viewRecords')}</h3>
            <Link
              to="/patient/records"
              className="flex items-center justify-between rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card transition-colors hover:bg-surface-container"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                  <Icon name="fileText" size={22} />
                </span>
                <span className="font-label-md text-label-md font-semibold text-on-surface">{t('patient.recordsTitle')}</span>
              </span>
              <Icon name="chevronRight" size={20} className="text-on-surface-variant" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
