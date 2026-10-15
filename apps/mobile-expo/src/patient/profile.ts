import { useCallback, useEffect, useState } from 'react';
import { tokenStore } from '@/auth/tokenStore';

import { getMyProfile } from './api';
import type { MyPatientProfile, PatientProfile } from './types';

/**
 * Shown wherever the backend genuinely has no value. Deliberately not a
 * plausible-looking number: the portal used to render demo vitals as if they
 * were the patient's own, and a fake "138/92" is worse than an honest dash.
 */
export const NOT_RECORDED = '—';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return NOT_RECORDED;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return NOT_RECORDED;
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function capitalize(value: string | null | undefined): string {
  if (!value) return NOT_RECORDED;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return NOT_RECORDED;
  return phone.startsWith('+') ? phone : `+91 ${phone}`;
}

function ageFromDob(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  const diff = Date.now() - dob.getTime();
  if (diff < 0) return null;
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

/** Web usePatientProfile.toProfile, verbatim: raw document → display strings. */
export function toProfile(profile: MyPatientProfile | undefined, authName?: string): PatientProfile {
  const vitals = profile?.vitals;
  const pregnancy = profile?.pregnancy;
  const bloodPressure =
    vitals?.bpSystolic != null && vitals?.bpDiastolic != null
      ? `${vitals.bpSystolic}/${vitals.bpDiastolic}`
      : NOT_RECORDED;

  return {
    id: profile?.beneficiaryId ?? profile?.userId ?? 'me',
    name: profile?.fullName ?? authName ?? '',
    abhaId: profile?.abhaId ?? NOT_RECORDED,
    age: profile?.ageYears ?? ageFromDob(profile?.dateOfBirth) ?? 0,
    gender: capitalize(profile?.gender),
    dob: formatDate(profile?.dateOfBirth),
    bloodGroup: profile?.bloodGroup ?? NOT_RECORDED,
    phone: formatPhone(profile?.phone),
    address: profile?.address ?? NOT_RECORDED,
    village: profile?.village ?? NOT_RECORDED,
    phc: profile?.phcName ?? NOT_RECORDED,
    ashaWorker: profile?.ashaWorkerName ?? NOT_RECORDED,
    height: vitals?.heightCm != null ? `${vitals.heightCm} cm` : NOT_RECORDED,
    weight: vitals?.weightKg != null ? `${vitals.weightKg} kg` : NOT_RECORDED,
    bmi: vitals?.bmi != null ? String(vitals.bmi) : NOT_RECORDED,
    latestBp: bloodPressure,
    pulse: vitals?.pulse != null ? `${vitals.pulse} bpm` : NOT_RECORDED,
    temperature: vitals?.temperature != null ? `${vitals.temperature} °C` : NOT_RECORDED,
    spo2: vitals?.spo2 != null ? `${vitals.spo2}%` : NOT_RECORDED,
    haemoglobin: vitals?.hemoglobin != null ? `${vitals.hemoglobin} g/dL` : NOT_RECORDED,
    bloodSugar: vitals?.bloodSugarRandom != null ? `${vitals.bloodSugarRandom} mg/dL` : NOT_RECORDED,
    waistCircumference: vitals?.waistCircumferenceCm != null ? `${vitals.waistCircumferenceCm} cm` : NOT_RECORDED,
    activeConditions: profile?.activeConditions ?? [],
    pregnant: profile?.isPregnant ?? false,
    trimester: pregnancy?.trimester ?? 0,
    week: pregnancy?.week ?? 0,
    lmp: formatDate(pregnancy?.lmp),
    edd: formatDate(pregnancy?.edd),
    ancVisits: pregnancy?.ancVisits ?? 0,
    highRisk: pregnancy?.highRisk ?? false,
  };
}

export type PatientProfileState = {
  /** Stable display projection — placeholder `—` values until the fetch lands. */
  display: PatientProfile;
  /** Raw `GET /patients/me` document; undefined while loading or offline. */
  raw: MyPatientProfile | undefined;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * The signed-in patient's profile from `GET /patients/me`.
 *
 * Returns a stable object immediately (NOT_RECORDED placeholders) and swaps in
 * real values once the request resolves, so callers never branch on loading
 * and never fall back to demo data — same contract as the web hook, minus
 * react-query (the mobile app loads through plain effects + a 60s cache).
 */
export function usePatientProfile(): PatientProfileState {
  const [raw, setRaw] = useState<MyPatientProfile | undefined>(undefined);
  const [authName, setAuthName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      // The auth name is the fallback while the profile itself is in flight.
      const user = await tokenStore.getUser().catch(() => null);
      if (!cancelled && user?.full_name) setAuthName(user.full_name);
      try {
        const profile = await getMyProfile();
        if (!cancelled) setRaw(profile);
      } catch (err) {
        // Offline is a normal state for this app: keep the placeholders and
        // surface the message so a screen can show its retry affordance.
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return {
    display: toProfile(raw, authName),
    raw,
    loading,
    error,
    reload,
  };
}
