import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useLocalization } from '@/hooks/useLocalization'
import { usePatientProfile } from '@/hooks/usePatientProfile'
import { useUIStore } from '@/stores/ui.store'
import { useAppStore } from '@/stores/app.store'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { patientService, apiErrorMessage, type AppointmentRequest } from '@/services/patient.service'
import type { AppointmentStatus } from '@/pages/patient/mockData'

type TabKey = 'all' | AppointmentStatus

interface DisplayAppointment {
  id: string
  type: string
  location: string
  date: string
  time: string
  status: AppointmentStatus
}

const REASONS = [
  { value: 'anc', labelKey: 'patient.reasonAnc' },
  { value: 'child', labelKey: 'patient.reasonChild' },
  { value: 'pnc', labelKey: 'patient.reasonPnc' },
  { value: 'general', labelKey: 'patient.reasonGeneral' },
] as const

function mapRequest(req: AppointmentRequest): DisplayAppointment {
  const isUpcoming = req.status === 'pending'
  const d = req.preferred_date ? new Date(req.preferred_date + 'T00:00:00') : null
  const dateStr = d
    ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'
  return {
    id: req.id,
    type: req.reason,
    location: req.asha_worker_name ? `ASHA: ${req.asha_worker_name}` : 'ASHA Worker',
    date: dateStr,
    time: req.preferred_time || '—',
    status: isUpcoming ? 'upcoming' : 'past',
  }
}

export default function PatientAppointmentsPage() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const followUps = useAppStore((s) => s.followUps)
  const markFollowUpDone = useAppStore((s) => s.markFollowUpDone)
  const [filter, setFilter] = useState<TabKey>('upcoming')

  const profile = usePatientProfile()
  const myFollowUps = followUps.filter((f) => f.patientName === profile.name && f.status === 'scheduled')

  // Appointments fetched from the API
  const [appointments, setAppointments] = useState<DisplayAppointment[]>([])

  const loadAppointments = useCallback(async () => {
    try {
      const requests = await patientService.listAppointmentRequests()
      setAppointments(requests.map(mapRequest))
    } catch {
      setAppointments([])
    }
  }, [])

  useEffect(() => {
    void loadAppointments()
  }, [loadAppointments])

  // Booking form state
  const [booking, setBooking] = useState(false)
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [bookingBusy, setBookingBusy] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const submitBooking = async (e: FormEvent) => {
    e.preventDefault()
    if (bookingBusy) return
    if (!reason) {
      setBookingError(t('patient.selectReason'))
      return
    }
    if (!date) {
      setBookingError(t('patient.selectDateError'))
      return
    }
    setBookingBusy(true)
    setBookingError(null)
    try {
      const reasonLabel = REASONS.find((r) => r.value === reason)?.labelKey ?? reason
      await patientService.createAppointmentRequest({
        reason: t(reasonLabel),
        preferredDate: date,
        preferredTime: time || undefined,
        notes: notes || undefined,
      })
      setBooking(false)
      setReason('')
      setDate('')
      setTime('')
      setNotes('')
      addToast('success', t('patient.appointmentBooked'))
      await loadAppointments()
    } catch (err) {
      setBookingError(apiErrorMessage(err, t('common.errorMsg')))
    } finally {
      setBookingBusy(false)
    }
  }

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
        actions={
          <button
            type="button"
            onClick={() => { setBookingError(null); setBooking(true) }}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98]"
          >
            <Icon name="plus" size={18} />
            {t('patient.bookAppointment')}
          </button>
        }
      />

      {/* Booking modal */}
      {booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setBooking(false)}>
          <div
            className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
              {t('patient.bookAppointmentTitle')}
            </h2>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
              {t('patient.bookAppointmentSubtitle')}
            </p>

            <form className="mt-5 flex flex-col gap-4" onSubmit={submitBooking}>
              <div>
                <label className="font-label-md text-label-md font-semibold text-on-surface">
                  {t('patient.selectReason')}
                </label>
                <select
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setBookingError(null) }}
                  className="mt-1.5 h-12 w-full rounded-lg border border-outline bg-surface px-3 font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none"
                >
                  <option value="">{t('patient.selectReason')}</option>
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{t(r.labelKey)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-label-md text-label-md font-semibold text-on-surface">
                  {t('patient.preferredDate')}
                </label>
                <input
                  type="date"
                  value={date}
                  min={today}
                  onChange={(e) => { setDate(e.target.value); setBookingError(null) }}
                  className="mt-1.5 h-12 w-full rounded-lg border border-outline bg-surface px-3 font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-label-md text-label-md font-semibold text-on-surface">
                  {t('patient.preferredTime')}
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-lg border border-outline bg-surface px-3 font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-label-md text-label-md font-semibold text-on-surface">
                  {t('patient.addNotes')}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1.5 w-full rounded-lg border border-outline bg-surface px-3 py-2 font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none"
                />
              </div>

              {bookingError ? (
                <p className="font-caption text-caption text-error">{bookingError}</p>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setBooking(false)}
                  className="flex-1 rounded-full border border-outline px-4 py-2.5 font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={bookingBusy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98] disabled:opacity-50"
                >
                  {bookingBusy ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" />
                  ) : (
                    <Icon name="calendar" size={18} />
                  )}
                  {t('patient.bookAppointment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              className={`rounded-full px-1.5 text-label-sm font-bold leading-4 ${
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
          {visible.map((appointment) => (
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
            </div>
          ))}
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
