import { listAppointmentRequests, type AppointmentRequest } from './api';
import type { Appointment } from './types';

/**
 * The signed-in patient's appointments, sourced from
 * `GET /patients/me/appointment-requests` — each request is an ASHATask the
 * patient's device also pulls via sync, but the API is the canonical source
 * (works even before the next sync completes).
 *
 * A request is "upcoming" while its task is still pending; once the ASHA
 * worker marks it done it becomes "past".
 */
export async function listAppointments(): Promise<Appointment[]> {
  try {
    const requests = await listAppointmentRequests();
    return requests.map(mapRequest);
  } catch {
    // Offline or endpoint unreachable — the screen shows the empty state.
    return [];
  }
}

function mapRequest(req: AppointmentRequest): Appointment {
  const isUpcoming = req.status === 'pending';
  const dateObj = req.preferred_date
    ? new Date(req.preferred_date + 'T00:00:00')
    : null;
  const dateStr = dateObj
    ? dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  return {
    id: req.id,
    type: req.reason,
    location: req.asha_worker_name ? `ASHA: ${req.asha_worker_name}` : 'ASHA Worker',
    date: dateStr,
    time: req.preferred_time || '—',
    status: isUpcoming ? 'upcoming' : 'past',
  };
}
