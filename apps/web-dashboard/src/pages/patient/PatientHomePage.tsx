import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useLocalization } from '@/hooks/useLocalization'
import { usePatientProfile } from '@/hooks/usePatientProfile'
import { patientService } from '@/services/patient.service'
import { childService } from '@/services/child.service'
import { Icon, type IconName } from '@/components/common/Icons'

interface QuickAction {
  label: string
  path: string
  icon: IconName
  tone: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'patient.viewProfile', path: '/patient/health-profile', icon: 'heart', tone: 'bg-primary-container text-on-primary-container' },
  { label: 'patient.viewRecords', path: '/patient/records', icon: 'fileText', tone: 'bg-secondary-container text-on-secondary-container' },
  { label: 'patient.viewVaccination', path: '/patient/vaccination', icon: 'checkCircle', tone: 'bg-tertiary-container text-on-tertiary-container' },
  { label: 'patient.bookAppointment', path: '/patient/appointments', icon: 'calendar', tone: 'bg-primary-container text-on-primary-container' },
]

function greeting(firstName: string, t: (k: string) => string) {
  const hour = new Date().getHours()
  if (hour < 12) return t('patient.greetingMorning').replace('{{name}}', firstName)
  if (hour < 17) return t('patient.greetingAfternoon').replace('{{name}}', firstName)
  return t('patient.greetingEvening').replace('{{name}}', firstName)
}

export default function PatientHomePage() {
  const { t } = useLocalization()
  const { user } = useAuth()

  const profile = usePatientProfile()
  const firstName = user?.fullName?.split(' ')[0] || profile.name.split(' ')[0]
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  // Real API data — never the shared zustand store, which is browser-persisted
  // across roles and used to show the ASHA's demo rows on the patient home.
  const appointmentsQuery = useQuery({
    queryKey: ['patient-home-appointments'],
    queryFn: () => patientService.listAppointmentRequests(),
  })
  const childrenQuery = useQuery({
    queryKey: ['patient-home-children'],
    queryFn: () => patientService.getMyChildren(),
  })

  const appointments = appointmentsQuery.data ?? []
  const children = childrenQuery.data ?? []
  const firstChild = children[0]

  const immunizationsQuery = useQuery({
    queryKey: ['patient-home-immunizations', firstChild?.id],
    queryFn: () => childService.listImmunizations(firstChild!.id),
    enabled: Boolean(firstChild?.id),
  })
  const immunizations = immunizationsQuery.data ?? []

  const upcoming = appointments.filter((a) => a.status === 'pending' || a.status === 'scheduled' || a.status === 'upcoming')
  const nextAppointment = upcoming[0]
  const vaccinationsDone = immunizations.filter((d) => d.status === 'given').length
  const vaccinationsTotal = immunizations.length

  // Only surface the vaccination quick action when the patient actually has
  // children — a woman with none should not see child-registration content.
  const actions = children.length > 0 ? QUICK_ACTIONS : QUICK_ACTIONS.filter((a) => a.path !== '/patient/vaccination')

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="flex flex-col gap-1 animate-fade-up">
        <p className="font-caption text-caption font-medium text-on-surface-variant">{today}</p>
        <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">{greeting(firstName, t)}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('patient.homeSubtitle')}</p>
      </section>

      <section className="grid grid-cols-2 gap-3 animate-fade-up animate-delay-100 lg:grid-cols-4">
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card">
          <div className="flex items-center gap-2 text-primary">
            <Icon name="calendar" size={20} />
            <span className="font-label-md text-label-md font-semibold">{t('patient.nextAppointment')}</span>
          </div>
          <p className="mt-3 font-display-lg text-display-lg font-bold text-on-surface">
            {nextAppointment?.preferred_date ? new Date(nextAppointment.preferred_date).getDate() : '—'}
          </p>
          <p className="font-caption text-caption text-on-surface-variant">
            {nextAppointment ? nextAppointment.reason : t('patient.noUpcoming')}
          </p>
        </div>
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card">
          <div className="flex items-center gap-2 text-secondary">
            <Icon name="fileText" size={20} />
            <span className="font-label-md text-label-md font-semibold">{t('patient.viewRecords')}</span>
          </div>
          <p className="mt-3 font-display-lg text-display-lg font-bold text-on-surface">—</p>
          <p className="font-caption text-caption text-on-surface-variant">{t('patient.recordsTitle')}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card">
          <div className="flex items-center gap-2 text-tertiary">
            <Icon name="checkCircle" size={20} />
            <span className="font-label-md text-label-md font-semibold">{t('patient.viewVaccination')}</span>
          </div>
          <p className="mt-3 font-display-lg text-display-lg font-bold text-on-surface">
            {children.length > 0 ? (
              <>
                {vaccinationsDone}
                <span className="text-body-md font-medium text-on-surface-variant">/{vaccinationsTotal}</span>
              </>
            ) : (
              '—'
            )}
          </p>
          <p className="font-caption text-caption text-on-surface-variant">
            {children.length > 0
              ? t('patient.dosesCompleted', { done: vaccinationsDone, total: vaccinationsTotal })
              : t('patient.noChildrenRegistered')}
          </p>
        </div>
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card">
          <div className="flex items-center gap-2 text-error">
            <Icon name="heart" size={20} />
            <span className="font-label-md text-label-md font-semibold">{t('patient.healthAtGlance')}</span>
          </div>
          <p className="mt-3 font-display-lg text-display-lg font-bold text-on-surface">{profile.latestBp}</p>
          <p className="font-caption text-caption text-on-surface-variant">{t('patient.latestBp')}</p>
        </div>
      </section>

      <section className="animate-fade-up animate-delay-150">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="activity" size={20} className="text-primary" />
          <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('patient.quickActions')}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {actions.map((action) => (
            <Link
              key={action.path}
              to={action.path}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 text-center shadow-card transition-all hover:bg-surface-container active:scale-[0.97]"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.tone}`}>
                <Icon name={action.icon} size={22} />
              </span>
              <span className="font-caption text-caption font-semibold leading-tight text-on-surface">{t(action.label)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="animate-fade-up">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('patient.upcomingAppointments')}</h2>
          <Link
            to="/patient/appointments"
            className="font-label-md text-label-md font-semibold text-primary transition-colors hover:text-on-primary-fixed-variant hover:underline"
          >
            {t('patient.viewAll')}
          </Link>
        </div>
        {upcoming.length > 0 ? (
          <div className="flex flex-col gap-3">
            {upcoming.map((appointment) => (
              <Link
                key={appointment.id}
                to="/patient/appointments"
                className="flex items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card transition-colors hover:bg-surface-container"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                  <Icon name="calendar" size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-label-md text-label-md font-semibold text-on-surface">{appointment.reason}</p>
                  <p className="font-caption text-caption text-on-surface-variant">{appointment.preferred_date}</p>
                </div>
                <div className="text-right">
                  <p className="font-label-md text-label-md font-semibold text-on-surface">{appointment.status}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
            {t('patient.noUpcoming')}
          </p>
        )}
      </section>
    </div>
  )
}
