import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { useASHAStore } from '@/stores/asha.store'
import { Icon } from '@/components/common/Icons'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import type { RiskLevel } from '@/pages/asha/mockData'

type Tab = 'summary' | 'history' | 'maternal' | 'vaccination' | 'referrals'

const riskStyles: Record<RiskLevel, string> = {
  low: 'bg-secondary-container text-on-secondary-container',
  medium: 'bg-[#FF8C00]/15 text-[#B34E00]',
  high: 'bg-error-container text-on-error-container',
}

const householdMembers = [
  { id: 'h1', initials: 'RK', name: 'Ram Kumar', meta: 'asha.husband', icon: 'users' as const },
  { id: 'h2', initials: 'AK', name: 'Aarav Kumar', meta: 'asha.son', icon: 'users' as const, highlighted: true },
]

const referralLog = [
  { id: 'r1', title: 'Referred to District Hospital', date: '15 Oct 2023', note: 'Severe anemia — Gynaecology OPD' },
  { id: 'r2', title: 'ANM Visit Scheduled', date: '12 Oct 2023', note: 'Routine home visit' },
]

export default function PatientDetailsAshaSathi() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const patients = useASHAStore((s) => s.patients)
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('summary')

  const patient = patients.find((p) => p.id === id) ?? patients[0]

  const tabs: { key: Tab; label: string }[] = [
    { key: 'summary', label: t('asha.tabSummary') },
    { key: 'history', label: t('asha.tabHistory') },
    { key: 'maternal', label: t('asha.tabMaternal') },
    { key: 'vaccination', label: t('asha.tabVaccination') },
    { key: 'referrals', label: t('asha.tabReferrals') },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Breadcrumbs
        items={[{ label: t('nav.ashaPatients'), to: '/asha/patients' }, { label: t('nav.patientDetails') }]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 font-headline-lg text-headline-lg font-bold text-on-surface">
            {patient.name}
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-label-md text-caption font-semibold ${riskStyles[patient.risk]}`}>
              <Icon name="alert" size={14} />
              {t(patient.risk === 'high' ? 'asha.riskHighLabel' : patient.risk === 'medium' ? 'asha.riskMediumLabel' : 'asha.riskLowLabel')}
            </span>
          </h1>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
            {t('asha.regId', { abha: patient.abhaId })} | {t('asha.regDate', { date: patient.registeredAt })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addToast('info', t('asha.editToast'))}
            className="flex items-center gap-2 rounded-full border border-primary px-4 py-2 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low"
          >
            <Icon name="edit" size={18} />
            {t('common.edit')}
          </button>
          <button
            type="button"
            onClick={() => addToast('success', t('asha.referToast'))}
            className="flex items-center gap-2 rounded-full bg-error px-4 py-2 font-label-md text-label-md font-semibold text-on-error shadow-sm transition-opacity hover:bg-opacity-90"
          >
            <Icon name="heart" size={18} />
            {t('asha.referSpecialist')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-outline-variant">
        <div className="flex min-w-max gap-6 px-1">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`whitespace-nowrap border-b-2 pb-2 font-label-md text-label-md font-semibold transition-colors ${
                tab === item.key ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'summary' ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <div className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-outline-variant bg-surface p-5 shadow-card md:flex-row">
              <span className={`absolute bottom-0 left-0 top-0 w-2 ${patient.risk === 'high' ? 'bg-error' : patient.risk === 'medium' ? 'bg-[#FF8C00]' : 'bg-secondary'}`} />
              <div className="flex shrink-0 justify-center pl-3 md:justify-start">
                <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-surface-container-lowest bg-primary-container font-display-lg text-display-lg font-bold text-on-primary-container shadow-sm md:h-32 md:w-32">
                  {patient.name.charAt(0)}
                </span>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-3 self-center">
                {[
                  { label: t('asha.age'), value: `${patient.age} ${t('asha.years')}` },
                  { label: t('asha.gender'), value: patient.gender },
                  { label: t('asha.bloodGroup'), value: patient.bloodGroup },
                  { label: t('asha.primaryLanguage'), value: t('asha.hindi') },
                ].map((row) => (
                  <div key={row.label}>
                    <p className="font-caption text-caption text-on-surface-variant">{row.label}</p>
                    <p className="font-body-md text-body-md font-semibold text-on-surface">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
              <h3 className="mb-4 flex items-center gap-2 font-headline-md text-headline-md font-semibold text-on-surface">
                <Icon name="fileText" size={20} className="text-primary" />
                {t('asha.contactDetails')}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex items-start gap-2">
                  <Icon name="phone" size={18} className="mt-1 text-on-surface-variant" />
                  <div>
                    <p className="font-caption text-caption text-on-surface-variant">{t('asha.phoneNumber')}</p>
                    <p className="font-body-md text-body-md text-on-surface">{patient.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Icon name="mapPin" size={18} className="mt-1 text-on-surface-variant" />
                  <div>
                    <p className="font-caption text-caption text-on-surface-variant">{t('asha.address')}</p>
                    <p className="font-body-md text-body-md text-on-surface">{patient.address}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
              <h3 className="mb-4 flex items-center gap-2 font-headline-md text-headline-md font-semibold text-error">
                <Icon name="activity" size={20} />
                {t('asha.activeConditions')}
              </h3>
              {patient.activeConditions.length === 0 ? (
                <p className="font-body-md text-body-md text-on-surface-variant">{t('asha.noConditions')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {patient.activeConditions.map((condition) => (
                    <li key={condition} className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface-container p-3">
                      <span className="font-body-md text-body-md font-semibold text-on-surface">{condition}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-headline-md text-headline-md font-semibold text-on-surface">
                  <Icon name="users" size={20} className="text-primary" />
                  {t('asha.householdMembers')}
                </h3>
                <button type="button" aria-label={t('asha.addMember')} onClick={() => addToast('info', t('asha.addMemberToast'))} className="rounded-full p-1 text-primary transition-colors hover:bg-primary-container/20">
                  <Icon name="plus" size={20} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {householdMembers.map((member) => (
                  <div
                    key={member.id}
                    className="relative flex items-center gap-2 overflow-hidden rounded-lg border border-outline-variant p-3 transition-colors hover:bg-surface-container-lowest"
                  >
                    {member.highlighted ? <span className="absolute bottom-0 left-0 top-0 w-1 bg-secondary" /> : null}
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container font-label-md font-bold text-primary">
                      {member.initials}
                    </span>
                    <div className="flex-1">
                      <p className="font-label-md text-label-md text-on-surface">{member.name}</p>
                      <p className="font-caption text-caption text-on-surface-variant">{t(member.meta)}</p>
                    </div>
                    {member.highlighted ? (
                      <Icon name="checkCircle" size={18} className="text-secondary" />
                    ) : (
                      <Icon name="chevronRight" size={18} className="text-on-surface-variant" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
              <p className="mb-2 font-caption text-caption text-on-surface-variant">{t('asha.assignedWorker')}</p>
              <div className="flex items-center gap-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-label-lg font-bold text-on-primary">
                  M
                </span>
                <div>
                  <p className="font-label-md text-label-md text-on-surface">{t('asha.workerName')}</p>
                  <p className="font-caption text-caption text-on-surface-variant">{t('asha.workerWard')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 font-headline-md text-headline-md font-semibold text-on-surface">
            <Icon name="fileText" size={20} className="text-primary" />
            {t('asha.medicalHistory')}
          </h3>
          <div className="flex flex-col gap-3">
            {patient.activeConditions.map((condition, i) => (
              <div key={condition} className="flex items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container p-4">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i === 0 ? 'bg-error' : 'bg-secondary'}`} />
                <div>
                  <p className="font-body-md text-body-md font-semibold text-on-surface">{condition}</p>
                  <p className="font-caption text-caption text-on-surface-variant">{t('asha.diagnosed')}</p>
                </div>
              </div>
            ))}
            {patient.activeConditions.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">{t('asha.noConditions')}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'maternal' ? (
        <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 font-headline-md text-headline-md font-semibold text-on-surface">
            <Icon name="heart" size={20} className="text-primary" />
            {t('asha.maternalHealth')}
          </h3>
          {patient.pregnant ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: t('asha.trimester'), value: patient.trimester ?? '—' },
                { label: t('asha.ancVisits'), value: '4 / 8' },
                { label: t('asha.edd'), value: '10 Jan 2024' },
              ].map((row) => (
                <div key={row.label} className="rounded-lg border border-outline-variant/50 bg-surface-container p-4">
                  <p className="font-caption text-caption text-on-surface-variant">{row.label}</p>
                  <p className="mt-1 font-headline-md text-headline-md font-semibold text-on-surface">{row.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-body-md text-body-md text-on-surface-variant">{t('asha.notPregnant')}</p>
          )}
        </div>
      ) : null}

      {tab === 'vaccination' ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
          <h3 className="flex items-center gap-2 font-headline-md text-headline-md font-semibold text-on-surface">
            <Icon name="checkCircle" size={20} className="text-primary" />
            {t('asha.vaccinationStatus')}
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('asha.vaccinationHint')}</p>
          <Link
            to={`/asha/patients/${patient.id}/immunization`}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
          >
            <Icon name="calendar" size={18} />
            {t('asha.viewSchedule')}
          </Link>
        </div>
      ) : null}

      {tab === 'referrals' ? (
        <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 font-headline-md text-headline-md font-semibold text-on-surface">
            <Icon name="activity" size={20} className="text-primary" />
            {t('asha.referrals')}
          </h3>
          <div className="flex flex-col gap-3">
            {referralLog.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container p-4">
                <Icon name="chevronRight" size={18} className="mt-1 text-primary" />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-body-md text-body-md font-semibold text-on-surface">{entry.title}</p>
                    <span className="whitespace-nowrap font-caption text-caption text-on-surface-variant">{entry.date}</span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant">{entry.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
