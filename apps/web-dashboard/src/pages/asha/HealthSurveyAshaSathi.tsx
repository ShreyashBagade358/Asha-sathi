import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { MOCK_SURVEYS, type SurveyStatus } from '@/pages/asha/mockData'

const STATUS_META: Record<SurveyStatus, { label: string; className: string; icon: 'checkCircle' | 'activity' | 'calendar' }> = {
  completed: { label: 'Completed', className: 'bg-secondary-container text-on-secondary-container', icon: 'checkCircle' },
  'in-progress': { label: 'In Progress', className: 'bg-tertiary-container text-on-tertiary-container', icon: 'activity' },
  pending: { label: 'Pending', className: 'bg-surface-variant text-on-surface-variant', icon: 'calendar' },
}

export default function HealthSurveyAshaSathi() {
  const { t } = useLocalization()
  const [filter, setFilter] = useState<'all' | SurveyStatus>('all')

  const visible = MOCK_SURVEYS.filter((s) => (filter === 'all' ? true : s.status === filter))

  const tabs: { key: 'all' | SurveyStatus; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: MOCK_SURVEYS.length },
    { key: 'pending', label: t('asha.surveyPending'), count: MOCK_SURVEYS.filter((s) => s.status === 'pending').length },
    { key: 'in-progress', label: t('asha.surveyInProgress'), count: MOCK_SURVEYS.filter((s) => s.status === 'in-progress').length },
    { key: 'completed', label: t('asha.surveyCompleted'), count: MOCK_SURVEYS.filter((s) => s.status === 'completed').length },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('asha.healthSurveyTitle')}
        subtitle={t('asha.healthSurveySubtitle')}
        breadcrumbs={[{ label: t('asha.healthSurveyTitle') }]}
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

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visible.map((survey) => {
          const meta = STATUS_META[survey.status]
          return (
            <div
              key={survey.id}
              className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card"
            >
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                    <Icon name="box" size={22} />
                  </span>
                  <div>
                    <p className="font-label-md text-label-md font-semibold text-on-surface">{survey.householdId}</p>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      {survey.headName} · {survey.village}
                    </p>
                  </div>
                </div>
                <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${meta.className}`}>
                  <Icon name={meta.icon} size={14} />
                  {meta.label}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-3">
                <div className="flex items-center gap-1.5 font-caption text-caption text-on-surface-variant">
                  <Icon name="users" size={15} className={survey.cleanWater ? 'text-tertiary' : 'text-error'} />
                  {survey.membersScreened}/{survey.familySize} screened
                </div>
                <div className="flex items-center gap-1.5 font-caption text-caption text-on-surface-variant">
                  <Icon name="checkCircle" size={15} className={survey.functionalToilet ? 'text-tertiary' : 'text-error'} />
                  Toilet
                </div>
                <div className="flex items-center gap-1.5 font-caption text-caption text-on-surface-variant">
                  <Icon name="alert" size={15} className={survey.recentFever ? 'text-error' : 'text-tertiary'} />
                  Fever
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-caption text-caption text-on-surface-variant">
                  <Icon name="calendar" size={14} className="mr-1 inline" />
                  {survey.date}
                </span>
                <Link
                  to="/asha/households/HH-2023-8942/visit"
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md font-semibold transition-all active:scale-[0.98] ${
                    survey.status === 'pending'
                      ? 'bg-primary text-on-primary hover:bg-on-primary-fixed-variant'
                      : 'border border-outline text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {survey.status === 'pending' ? t('asha.startSurvey') : t('asha.viewSurvey')}
                  <Icon name="chevronRight" size={16} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
