import { useState } from 'react'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { useAppStore, patientPortalProfile } from '@/stores/app.store'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import type { AppointmentStatus } from '@/pages/patient/mockData'

type TabKey = 'all' | AppointmentStatus

export default function PatientAppointmentsPage() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const appointments = useAppStore((s) => s.appointments)
  const followUps = useAppStore((s) => s.followUps)
  const markFollowUpDone = useAppStore((s) => s.markFollowUpDone)
  const patients = useAppStore((s) => s.patients)
  const [filter, setFilter] = useState<TabKey>('upcoming')
  const [attended, setAttended] = useState<Record<string, boolean>>({})

  const profile = patientPortalProfile(patients)
  const myFollowUps = followUps.filter((f) => f.patientName === profile.name && f.status === 'scheduled')

  const upcomingCount = appointments.filter((a) => a.status === 'upcoming').length
  const pastCount = appointments.filter((a) => a.status === 'past').length

  const visible = appointments.filter((a) => (filter === 'all' ? true : a.status === filter))

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'upcoming', label: t('patient.tabUpcoming'), count: upcomingCount },
    { key: 'past', label: t('patient.tabPast'), count: pastCount },
    { key: 'all', label: t('patient.tabAll'), count: appointments.length },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('patient.appointmentsTitle')}
        subtitle={t('patient.appointmentsSubtitle')}
        breadcrumbs={[{ label: t('patient.appointmentsTitle') }]}
        actions={
          <button
            type="button"
            onClick={() => addToast('info', t('patient.bookAppointment'))}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98]"
          >
            <Icon name="plus" size={18} />
            {t('patient.bookAppointment')}
          </button>
        }
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

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
          {filter === 'upcoming' ? t('patient.noUpcomingAppointments') : t('patient.noPastAppointments')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((appointment) => {
            const isAttended = attended[appointment.id]
            return (
              <div
                key={appointment.id}
                className={`overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card ${
                  appointment.status === 'upcoming' ? 'ring-1 ring-primary/20' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                        appointment.status === 'upcoming'
                          ? 'bg-primary-container text-on-primary-container'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      <Icon name="calendar" size={22} />
                    </span>
                    <div>
                      <p className="font-label-md text-label-md font-semibold text-on-surface">{appointment.type}</p>
                      {appointment.doctor ? (
                        <p className="font-caption text-caption text-on-surface-variant">{appointment.doctor}</p>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${
                      appointment.status === 'upcoming'
                        ? 'bg-primary-container text-on-primary-container'
                        : 'bg-surface-variant text-on-surface-variant'
                    }`}
                  >
                    {appointment.status === 'upcoming' ? t('patient.tabUpcoming') : t('patient.tabPast')}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-3">
                  <p className="flex items-center gap-1.5 font-caption text-caption text-on-surface-variant">
                    <Icon name="mapPin" size={14} />
                    {appointment.location}
                  </p>
                  <p className="flex items-center gap-1.5 font-caption text-caption text-on-surface-variant">
                    <Icon name="calendar" size={14} />
                    {appointment.date} · {appointment.time}
                  </p>
                </div>

                {appointment.status === 'upcoming' ? (
                  <div className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAttended((prev) => ({ ...prev, [appointment.id]: true }))
                        addToast('success', t('patient.attendanceToast'))
                      }}
                      disabled={isAttended}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon name={isAttended ? 'checkCircle' : 'check'} size={18} />
                      {isAttended ? t('patient.tabPast') : t('patient.confirmAttendance')}
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <section>
        <h2 className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">{t('patient.followUps')}</h2>
        {myFollowUps.length === 0 ? (
          <p className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
            {t('patient.noUpcoming')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {myFollowUps.map((fu) => (
              <div key={fu.id} className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
                    <Icon name="activity" size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-label-md text-label-md font-semibold text-on-surface">{fu.type}</p>
                    <p className="truncate font-caption text-caption text-on-surface-variant">
                      {fu.due} · {fu.notes ?? t('asha.fuScheduled')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      markFollowUpDone(fu.id)
                      addToast('success', t('asha.fuDoneToast'))
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98]"
                  >
                    <Icon name="check" size={16} />
                    {t('asha.fuMarkDone')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
