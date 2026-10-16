import { useMemo } from 'react'
import { useLocalDateTime } from '@/hooks/useLocalDateTime'
import { useWeather } from '@/hooks/useWeather'
import { DynamicWeatherIcon } from '@/components/weather/DynamicWeatherIcon'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useLocalization } from '@/hooks/useLocalization'
import { useTodayTasks } from '@/hooks/useTodayTasks'
import { notificationService } from '@/services/notification.service'
import { householdService } from '@/services/household.service'
import { pregnancyService } from '@/services/pregnancy.service'
import { beneficiaryService } from '@/services/beneficiary.service'
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
  { label: 'asha.modHealthSurvey', path: '/asha/health-survey', icon: 'edit', tone: 'bg-primary-fixed text-primary' },
  { label: 'asha.modPregnancy', path: '/asha/pregnancy', icon: 'heart', tone: 'bg-maternal-light text-maternal' },
  { label: 'asha.modChildHealth', path: '/asha/child-health', icon: 'heart', tone: 'bg-amber-light text-amber' },
  { label: 'asha.modVaccination', path: '/asha/child-health', icon: 'checkCircle', tone: 'bg-teal-light text-teal' },
  { label: 'asha.modHealthCheckup', path: '/asha/health-checkup', icon: 'activity', tone: 'bg-primary-container text-on-primary-container' },
  { label: 'asha.modReferral', path: '/asha/referrals', icon: 'fileText', tone: 'bg-primary-fixed text-primary' },
  { label: 'asha.modFollowUp', path: '/asha/follow-ups', icon: 'refresh', tone: 'bg-teal-light text-teal' },
  { label: 'asha.modTasks', path: '/asha/tasks', icon: 'checkCircle', tone: 'bg-primary-container text-on-primary-container' },
  { label: 'asha.modNotifications', path: '/asha/notifications', icon: 'bell', tone: 'bg-maternal-light text-maternal' },
  { label: 'asha.modSync', path: '/asha/sync', icon: 'refresh', tone: 'bg-primary-fixed text-primary' },
  { label: 'asha.modProfile', path: '/asha/profile', icon: 'settings', tone: 'bg-neutral-100 text-neutral-500' },
]

function greetingForPeriod(period: string, firstName: string, t: (k: string) => string) {
  if (period === 'morning') return t('asha.greetingMorning').replace('{{name}}', firstName)
  if (period === 'afternoon') return t('asha.greetingAfternoon').replace('{{name}}', firstName)
  if (period === 'evening') return t('asha.greetingEvening').replace('{{name}}', firstName)
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

  const { tasks, toggleTask } = useTodayTasks()

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'asha'],
    queryFn: () => notificationService.listNotifications({ pageSize: 50 }),
  })
  const alerts = (notificationsQuery.data?.items ?? [])
    .filter((n) => n.type === 'alert')
    .map((n) => {
      const parsed = n.createdAt ? new Date(n.createdAt) : null
      const time =
        parsed && !Number.isNaN(parsed.getTime())
          ? parsed.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : (n.createdAt ?? '')
      return { id: n.id, title: n.title, message: n.message, time }
    })

  const householdsQuery = useQuery({
    queryKey: ['asha', 'households', 'count'],
    queryFn: () => householdService.listHouseholds({ pageSize: 1 }),
  })
  const pregnanciesQuery = useQuery({
    queryKey: ['asha', 'pregnancies', 'ongoing'],
    queryFn: () => pregnancyService.listPregnancies({ status: 'ongoing', pageSize: 200 }),
  })
  const beneficiariesQuery = useQuery({
    queryKey: ['asha', 'beneficiaries', 'count'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 200 }),
  })

  const pending = tasks.filter((x) => !x.done).length
  const highRiskPregnancies = (pregnanciesQuery.data?.items ?? []).filter((p) => p.highRisk).length
  const highRiskBeneficiaries = (beneficiariesQuery.data?.items ?? []).filter(
    (b) => (b.risk ?? '').toLowerCase() === 'high',
  ).length
  const highRisk = highRiskPregnancies + highRiskBeneficiaries
  const todayISO = new Date().toISOString().slice(0, 10)
  const visitsPlanned = tasks.filter((x) => !x.done && (x.due ?? '') <= todayISO).length
  const householdsCount = householdsQuery.data?.total ?? 0

  const stats: Stat[] = useMemo(
    () => [
      { label: t('asha.agenda'), value: String(visitsPlanned), hint: t('asha.visitsPlanned'), icon: 'activity', tone: 'primary' },
      { label: t('asha.pendingTasks'), value: String(pending), hint: t('asha.needAttention'), icon: 'checkCircle', tone: 'tertiary' },
      { label: t('asha.households'), value: String(householdsCount), hint: t('asha.underYourCare'), icon: 'users', tone: 'secondary' },
      { label: t('asha.highRisk'), value: String(highRisk), hint: t('asha.needMonitoring'), icon: 'alert', tone: 'error' },
    ],
    [t, pending, highRisk, visitsPlanned, householdsCount],
  )

  const firstName = user?.fullName?.split(' ')[0] || 'there'
  const { now, period, formattedDate } = useLocalDateTime()
  const weather = useWeather(period, now.getHours())
  const greetingText = greetingForPeriod(period, firstName, t)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section
        className="animate-fade-up overflow-hidden rounded-3xl border border-outline-variant/30 p-5 sm:p-7"
        style={{ background: 'linear-gradient(135deg, #F5F8FF 0%, #FFFFFF 100%)' }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <p className="mb-2 text-[18px] font-medium text-[#627DA8] sm:text-[20px]">{formattedDate}</p>
            <div className="flex items-center gap-3">
              <DynamicWeatherIcon condition={weather.condition} size={44} />
              <h1 className="text-[26px] font-bold leading-tight text-[#17265F] sm:text-[32px] lg:text-[36px]">
                {greetingText.split(firstName)[0]}
                <span className="text-[#4438B8]">{firstName}</span>
                {greetingText.includes('!') ? '!' : ''}
              </h1>
            </div>
            <p className="mt-2 max-w-lg text-[16px] text-[#627DA8] sm:text-[18px]">
              Here's what's happening in your area today.
            </p>
          </div>
          <div className="hidden shrink-0 lg:block" aria-hidden="true">
            <svg viewBox="0 0 180 140" width="180" height="140" className="opacity-90">
              <ellipse cx="90" cy="75" rx="75" ry="55" fill="#D9F0FC" opacity="0.4" />
              <ellipse cx="40" cy="45" rx="20" ry="12" fill="#D9F0FC" opacity="0.5" />
              <ellipse cx="145" cy="50" rx="18" ry="10" fill="#D9F0FC" opacity="0.45" />
              <ellipse cx="65" cy="110" rx="22" ry="10" fill="#D9F0FC" opacity="0.4" />
              <path d="M75 115 Q78 95 85 85 Q80 90 75 95 Q70 90 65 95 Q72 95 75 115Z" fill="#A7C8E8" opacity="0.6" />
              <path d="M115 110 Q118 92 125 84 Q120 88 115 93 Q110 88 105 93 Q112 93 115 110Z" fill="#A7C8E8" opacity="0.5" />
              <circle cx="90" cy="58" r="16" fill="#F5D5C8" />
              <path d="M74 58 Q74 38 90 38 Q106 38 106 58" fill="#2D2A3E" />
              <rect x="76" y="74" width="28" height="42" rx="8" fill="#6C63FF" />
              <rect x="78" y="74" width="24" height="42" rx="6" fill="#7164D8" />
              <rect x="83" y="88" width="14" height="18" rx="2" fill="#E8EDFF" />
              <line x1="85" y1="93" x2="95" y2="93" stroke="#B0B8D8" strokeWidth="1" />
              <line x1="85" y1="97" x2="95" y2="97" stroke="#B0B8D8" strokeWidth="1" />
              <line x1="85" y1="101" x2="92" y2="101" stroke="#B0B8D8" strokeWidth="1" />
              <text x="90" y="132" textAnchor="middle" fontSize="8.5" fill="#4438B8" fontFamily="cursive" fontStyle="italic">Healthy Families</text>
              <text x="90" y="140" textAnchor="middle" fontSize="8.5" fill="#4438B8" fontFamily="cursive" fontStyle="italic">Stronger Communities</text>
              <path d="M86 148 Q86 144 90 144 Q94 144 94 148 Q94 152 90 155 Q86 152 86 148Z" fill="none" stroke="#7164D8" strokeWidth="1.2" />
            </svg>
          </div>
        </div>
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
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-secondary p-4 text-on-secondary shadow-sm transition-all duration-200 hover:bg-on-secondary-fixed-variant active:scale-[0.97]"
        >
          <Icon name="edit" size={28} />
          <span className="font-label-md text-label-md text-center font-semibold leading-tight">{t('asha.recordVisit')}</span>
        </Link>
        <Link
          to="/asha/connection-error"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-emergency p-4 text-white shadow-sm transition-all duration-200 hover:bg-emergency-hover active:scale-[0.97]"
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
              <Link
                to="/asha/notifications"
                className="mt-3 block w-full rounded-full bg-error px-4 py-2.5 text-center font-label-md text-label-md font-semibold text-white shadow-sm transition-all hover:bg-red-800 active:scale-[0.98]"
              >
                {t('asha.reviewNow')}
              </Link>
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
          {tasks
            .filter((task) => !task.done && (task.due ?? '') <= todayISO)
            .map((visit) => (
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
                        {visit.title}
                      </span>
                      <span className="font-caption text-caption text-on-surface-variant">{visit.due}</span>
                    </div>
                    <p className="mt-1 font-headline-md text-headline-md font-semibold text-on-surface">{visit.householdLabel || '—'}</p>
                    <p className="flex items-center gap-1 font-body-md text-body-md text-on-surface-variant">
                      <Icon name="mapPin" size={16} />
                      {visit.subtitle || visit.householdHhid || '—'}
                    </p>
                  </div>
                </div>
                <Link
                  to={visit.householdId ? `/asha/households/${visit.householdId}` : '/asha/tasks'}
                  aria-label={t('asha.navigateTo', { name: visit.householdLabel })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-sm transition-all hover:bg-primary hover:text-on-primary active:scale-95"
                >
                  <Icon name="activity" size={22} />
                </Link>
              </div>
            ))}
          {tasks.filter((task) => !task.done && (task.due ?? '') <= todayISO).length === 0 && (
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
              {t('asha.noTasksHint')}
            </div>
          )}
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
                onClick={() => toggleTask(task)}
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
