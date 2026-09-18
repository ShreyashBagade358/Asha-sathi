import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { useASHAStore } from '@/stores/asha.store'
import { Icon, type IconName } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import type { RiskLevel } from '@/pages/asha/mockData'

const riskChip: Record<RiskLevel, { label: string; cls: string; icon: IconName }> = {
  low: { label: 'asha.riskLowLabel', cls: 'bg-secondary-container text-on-secondary-container', icon: 'checkCircle' },
  medium: { label: 'asha.riskMediumLabel', cls: 'bg-[#FF8C00]/15 text-[#B34E00]', icon: 'alert' },
  high: { label: 'asha.riskHighLabel', cls: 'bg-error-container text-on-error-container', icon: 'alert' },
}

export default function PatientDashboardAshaSathi() {
  const { t } = useLocalization()
  const patients = useASHAStore((s) => s.patients)
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState<'all' | RiskLevel>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return patients.filter((p) => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.abhaId.toLowerCase().includes(q) || p.village.toLowerCase().includes(q)
      const matchesRisk = risk === 'all' || p.risk === risk
      return matchesQuery && matchesRisk
    })
  }, [patients, query, risk])

  const counts = useMemo(
    () => ({
      all: patients.length,
      high: patients.filter((p) => p.risk === 'high').length,
      medium: patients.filter((p) => p.risk === 'medium').length,
      low: patients.filter((p) => p.risk === 'low').length,
    }),
    [patients],
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title={t('asha.patientsTitle')}
        subtitle={t('asha.patientsSubtitle')}
        breadcrumbs={[{ label: t('nav.ashaPatients') }]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Icon name="search" size={18} className="absolute inset-y-0 left-3.5 my-auto text-on-surface-variant" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('asha.patientSearchPlaceholder')}
            className="h-touch-target w-full rounded-lg border border-outline bg-surface-container-lowest pl-10 pr-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'high', 'medium', 'low'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRisk(key)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 font-label-md text-label-md font-semibold transition-colors ${
                risk === key ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {key === 'all' ? t('asha.filterAll') : t(riskChip[key].label)}
              <span
                className={`rounded-full px-1.5 text-[11px] font-bold leading-4 ${
                  risk === key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-variant text-on-surface-variant'
                }`}
              >
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest py-12 text-center shadow-card">
          <Icon name="users" size={32} className="text-outline" />
          <p className="font-body-md text-body-md text-on-surface-variant">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card">
          {filtered.map((patient, index) => (
            <Link
              key={patient.id}
              to={`/asha/patients/${patient.id}`}
              className={`flex items-center gap-3 p-4 transition-colors hover:bg-surface-container ${
                index < filtered.length - 1 ? 'border-b border-outline-variant/40' : ''
              }`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-container font-label-lg font-bold text-on-primary-container">
                {patient.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-label-md text-label-md font-semibold text-on-surface">
                  {patient.name}
                  {patient.pregnant ? (
                    <span className="rounded-full bg-secondary-container px-2 py-0.5 font-caption text-caption text-on-secondary-container">
                      {patient.trimester}
                    </span>
                  ) : null}
                </p>
                <p className="truncate font-caption text-caption text-on-surface-variant">
                  {patient.abhaId} • {patient.age} yrs • {patient.village}
                </p>
              </div>
              <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-caption text-caption font-semibold sm:inline-flex ${riskChip[patient.risk].cls}`}>
                <Icon name={riskChip[patient.risk].icon} size={14} />
                {t(riskChip[patient.risk].label)}
              </span>
              <Icon name="chevronRight" size={20} className="shrink-0 text-on-surface-variant" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
