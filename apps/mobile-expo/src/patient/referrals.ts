import { listReferrals, type Referral } from '@/db/clinical';

import { NOT_RECORDED } from './profile';
import type { PatientReferral, PatientReferralStatus, PatientReferralUrgency } from './types';

/**
 * The signed-in patient's referrals from local SQLite.
 *
 * The web page filters `useAppStore.referrals` down to the signed-in name; on
 * mobile the sync scope already guarantees every local referral row belongs to
 * this patient, so the list is a straight map. Facility / author names are not
 * synced locally, so the screen shows the referral type and honest dashes —
 * never invented values.
 */

const STATUSES: PatientReferralStatus[] = ['pending', 'accepted', 'completed', 'cancelled'];
const URGENCIES: PatientReferralUrgency[] = ['routine', 'urgent', 'emergency'];

function toStatus(value: string | null): PatientReferralStatus {
  const status = String(value ?? '').toLowerCase();
  return (STATUSES.find((s) => status === s) ?? 'pending') satisfies PatientReferralStatus;
}

function toUrgency(value: string | null): PatientReferralUrgency {
  const urgency = String(value ?? '').toLowerCase();
  if (urgency.includes('emergen')) return 'emergency';
  if (urgency.includes('urgent')) return 'urgent';
  return (URGENCIES.find((u) => urgency === u) ?? 'routine') satisfies PatientReferralUrgency;
}

function displayDate(iso: string | null | undefined): string {
  if (!iso) return NOT_RECORDED;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return NOT_RECORDED;
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toPatientReferral(row: Referral): PatientReferral {
  return {
    id: row.id,
    toFacility: row.referral_type ?? NOT_RECORDED,
    date: displayDate(row.initiated_at),
    referredBy: NOT_RECORDED,
    reason: row.reason ?? row.clinical_summary ?? NOT_RECORDED,
    status: toStatus(row.status),
    urgency: toUrgency(row.urgency),
  };
}

export async function loadPatientReferrals(): Promise<PatientReferral[]> {
  const rows = await listReferrals();
  return rows.map(toPatientReferral);
}
