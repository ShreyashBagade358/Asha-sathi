import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useLocalization } from '@/hooks/useLocalization'
import { useAppStore } from '@/stores/app.store'
import { Icon, type IconName } from '@/components/common/Icons'

interface Stat {
  label: string
  value: string
  hint: string
  icon: IconName
  tone: 'primary' | 'tertiary' | 'secondary' | 'error'
}

interface CareModule {
  label: string
  path: string
  icon: IconName
  tone: string
}

const CARE_MODULES: CareModule[] = [
  { label: 'asha.modAddPatient', path: '/asha/patients/new', icon: 'plus', tone: 'bg-primary-container text-on-primary-container' },
  { label: 'asha.modHouseholds', path: '/asha/households', icon: 'box', tone: 'bg-secondary-container text-on-secondary-container' },
  { label: 'asha.modHealthSurvey', path: '/asha/health-survey', icon: 'edit', tone: 'bg-tertiary-container text-on-tertiary-container' },
  { label: 'asha.modPregnancy', path: '/asha/pregnancy', icon: 'heart', tone: 'bg-primary-container text-on-primary-container' },
  { label: 'asha.modChildHealth', path: '/asha/child-health', icon: 'heart', tone: 'bg-secondary-container text-on-secondary-container' },
  { label: 'asha.modVaccination', path: '/asha/patients/1/immunization', icon: 'checkCircle', tone: 'bg-tertiary-container text-on-tertiary-container' },
  { label: 'asha.modHealthCheckup', path: '/asha/health-checkup', icon: 'activity', tone: 'bg-primary-container text-on-primary-container' },
  { label: 'asha.modReferral', path: '/asha/referrals', icon: 'fileText', tone: 'bg-secondary-container text-on-secondary-container' },
  { label: 'asha.modFollowUp', path: '/asha/follow-ups', icon: 'refresh', tone: 'bg-tertiary-container text-on-tertiary-container' },
  { label: 'asha.modTasks', path: '/asha/tasks', icon: 'checkCircle', tone: 'bg-surface-variant text-on-surface-variant' },
  { label: 'asha.modNotifications', path: '/asha/notifications', icon: 'bell', tone: 'bg-error-container text-on-error-container' },
  { label: 'asha.modSync', path: '/asha/sync', icon: 'refresh', tone: 'bg-surface-variant text-on-surface-variant' },
  { label: 'asha.modProfile', path: '/asha/profile', icon: 'settings', tone: 'bg-surface-variant text-on-surface-variant' },
]

function greeting(firstName: string, t: (k: string) => string) {
  const hour = new Date().getHours()
  if (hour < 12) return t('asha.greetingMorning').replace('{{name}}', firstName)
  if (hour < 17) return t('asha.greetingAfternoon').replace('{{name}}', firstName)
  return t('asha.greetingEvening').replace('{{name}}', firstName)
}

const toneText: Record<Stat['tone'], string> = {
  primary: 'text-primary',
  tertiary: 'text-tertiary',
  secondary: 'text-secondary',
  error: 'text-error',
}

export default function AshaWorkerHomeAshaSathi() {
  const { t } = useLocalization()
  const { user } = useAuth()
  const tasks = useAppStore((s) => s.tasks)
  const toggleTask = useAppStore((s) => s.toggleTask)
  const patients = useAppStore((s) => s.patients)
  const pregnancies = useAppStore((s) => s.pregnancies)
  const followUps = useAppStore((s) => s.followUps)
  const ashaNotifications = useAppStore((s) => s.notifications)
  const alerts = ashaNotifications.filter((n) => n.type === 'alert')

  const pending = tasks.filter((x) => !x.done).length
  const highRisk = patients.filter((p) => p.risk === 'high').length + pregnancies.filter((p) => p.risk === 'high').length
  const visitsPlanned = followUps.filter((f) => f.status !== 'completed').length

  const stats: Stat[] = useMemo(
    () => [
      { label: t('asha.agenda'), value: String(visitsPlanned), hint: t('asha.visitsPlanned'), icon: 'activity', tone: 'primary' },
      { label: t('asha.pendingTasks'), value: String(pending), hint: t('asha.needAttention'), icon: 'checkCircle', tone: 'tertiary' },
      { label: t('asha.households'), value: String(patients.length), hint: t('asha.underYourCare'), icon: 'users', tone: 'secondary' },
      { label: t('asha.highRisk'), value: String(highRisk), hint: t('asha.needMonitoring'), icon: 'alert', tone: 'error' },
    ],
    [t, pending, highRisk, visitsPlanned, patients.length],
  )

  const firstName = user?.fullName?.split(' ')[0] || 'there'
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="flex flex-col gap-1 animate-fade-up">
        <p className="font-caption text-caption font-medium text-on-surface-variant">{today}</p>
        <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">{greeting(firstName, t)}</h1>
      </section>

      <section className="grid grid-cols-1 gap-3 animate-fade-up animate-delay-100 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card">
            <div className={`flex items-center gap-2 ${toneText[stat.tone]}`}>
              <Icon name={stat.icon} size={20} />
              <span className="font-label-md text-label-md font-semibold">{stat.label}</span>
            </div>
            <p className="mt-3 font-display-lg text-display-lg font-bold text-on-surface">{stat.value}</p>
            <p className="font-caption text-caption text-on-surface-variant">{stat.hint}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-3 gap-3 animate-fade-up animate-delay-200">
        <Link
          to="/asha/patients/new"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-primary p-4 text-on-primary shadow-sm transition-all duration-200 hover:bg-on-primary-fixed-variant active:scale-[0.97]"
        >
          <Icon name="plus" size={28} />
          <span className="font-label-md text-label-md text-center font-semibold leading-tight">{t('asha.addPatient')}</span>
        </Link>
        <Link
          to="/asha/households"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-primary p-4 text-on-primary shadow-sm transition-all duration-200 hover:bg-on-primary-fixed-variant active:scale-[0.97]"
        >
          <Icon name="edit" size={28} />
          <span className="font-label-md text-label-md text-center font-semibold leading-tight">{t('asha.recordVisit')}</span>
        </Link>
        <Link
          to="/asha/connection-error"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-error p-4 text-white shadow-sm transition-all duration-200 hover:bg-red-800 active:scale-[0.97]"
        >
          <Icon name="alert" size={28} />
          <span className="font-label-md text-label-md text-center font-semibold leading-tight">{t('asha.emergency')}</span>
        </Link>
      </section>

      <section className="animate-fade-up animate-delay-150">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="dashboard" size={20} className="text-primary" />
          <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.careModules')}</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {CARE_MODULES.map((module) => (
            <Link
              key={module.path + module.label}
              to={module.path}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 text-center shadow-card transition-all hover:bg-surface-container active:scale-[0.97]"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${module.tone}`}>
                <Icon name={module.icon} size={22} />
              </span>
              <span className="font-caption text-caption font-semibold leading-tight text-on-surface">{t(module.label)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="animate-fade-up">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="alert" size={20} className="text-error" />
          <h2 className="font-headline-md text-headline-md font-semibold text-error">{t('asha.highRiskAlerts')}</h2>
        </div>
        <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0">
          {alerts.map((n) => (
            <div
              key={n.id}
              className="relative min-w-[280px] flex-1 snap-center overflow-hidden rounded-2xl border border-error/20 bg-error-container p-4 pl-5 shadow-sm lg:min-w-0"
            >
              <span className="absolute bottom-0 left-0 top-0 w-1.5 bg-error" />
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-full bg-error/10 px-2.5 py-1 font-caption text-caption font-semibold text-on-error-container">
                  ALERT
                </span>
                <span className="font-caption text-caption text-on-error-container/80">{n.time}</span>
              </div>
              <p className="mt-3 font-headline-md text-headline-md font-semibold text-on-error-container">{n.title}</p>
              <p className="font-body-md text-body-md text-on-error-container/80">{n.message}</p>
              <button
                type="button"
                className="mt-3 w-full rounded-full bg-error px-4 py-2.5 font-label-md text-label-md font-semibold text-white shadow-sm transition-all hover:bg-red-800 active:scale-[0.98]"
              >
                {t('asha.reviewNow')}
              </button>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
              {t('asha.noAlerts')}
            </div>
          )}
        </div>
      </section>

      <section className="animate-fade-up">
        <h2 className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.todaysVisits')}</h2>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {followUps.filter((f) => f.status === 'scheduled').map((visit) => (
            <div
              key={visit.id}
              className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 pl-5 shadow-card"
            >
              <span className="absolute bottom-0 left-0 top-0 w-1.5 bg-secondary" />
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <Icon name="heart" size={22} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption font-semibold text-on-surface-variant">
                      {visit.type}
                    </span>
                    <span className="font-caption text-caption text-on-surface-variant">{visit.due}</span>
                  </div>
                  <p className="mt-1 font-headline-md text-headline-md font-semibold text-on-surface">{visit.patientName}</p>
                  <p className="flex items-center gap-1 font-body-md text-body-md text-on-surface-variant">
                    <Icon name="mapPin" size={16} />
                    {visit.notes ?? 'Follow-up scheduled'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={t('asha.navigateTo', { name: visit.patientName })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-sm transition-all hover:bg-primary hover:text-on-primary active:scale-95"
              >
                <Icon name="activity" size={22} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="animate-fade-up">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.pendingTasks')}</h2>
          <Link
            to="/asha/tasks"
            className="font-label-md text-label-md font-semibold text-primary transition-colors hover:text-on-primary-fixed-variant hover:underline"
          >
            {t('asha.viewAll')}
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card">
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className={`flex items-center justify-between gap-3 p-4 transition-colors ${
                index < tasks.length - 1 ? 'border-b border-outline-variant/40' : ''
              } ${task.done ? 'bg-surface-container-low/60' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                    task.done ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-container text-on-tertiary-container'
                  }`}
                >
                  <Icon name={task.done ? 'checkCircle' : 'activity'} size={20} />
                </span>
                <div>
                  <p className={`font-label-md text-label-md font-semibold text-on-surface ${task.done ? 'line-through opacity-60' : ''}`}>
                    {task.title}
                  </p>
                  <p className="font-caption text-caption text-on-surface-variant">{task.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleTask(task.id)}
                aria-label={task.done ? t('asha.markPending') : t('asha.markDone')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary transition-all hover:bg-surface-container active:scale-90"
              >
                <Icon name={task.done ? 'checkCircle' : 'check'} size={22} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
