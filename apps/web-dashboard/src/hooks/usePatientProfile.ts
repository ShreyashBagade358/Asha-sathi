import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/hooks/useAuth'
import { patientService, type MyPatientProfile } from '@/services/patient.service'
import type { PatientProfile } from '@/pages/patient/mockData'

/**
 * Shown wherever the backend genuinely has no value. Deliberately not a
 * plausible-looking number: the portal used to render demo vitals as if they
 * were the patient's own, and a fake "138/92" is worse than an honest dash.
 */
export const NOT_RECORDED = '—'

export const PROFILE_QUERY_KEY = 'patient-profile'

function formatDate(iso: string | null | undefined): string {
  if (!iso) return NOT_RECORDED
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return NOT_RECORDED
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function capitalize(value: string | null | undefined): string {
  if (!value) return NOT_RECORDED
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return NOT_RECORDED
  return phone.startsWith('+') ? phone : `+91 ${phone}`
}

function ageFromDob(iso: string | null | undefined): number | null {
  if (!iso) return null
  const dob = new Date(iso)
  if (Number.isNaN(dob.getTime())) return null
  const diff = Date.now() - dob.getTime()
  if (diff < 0) return null
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

function toProfile(profile: MyPatientProfile | undefined, authName?: string): PatientProfile {
  const vitals = profile?.vitals
  const pregnancy = profile?.pregnancy
  const bloodPressure =
    vitals?.bpSystolic != null && vitals?.bpDiastolic != null
      ? `${vitals.bpSystolic}/${vitals.bpDiastolic}`
      : NOT_RECORDED

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
    latestBp: bloodPressure,
    haemoglobin: vitals?.hemoglobin != null ? `${vitals.hemoglobin} g/dL` : NOT_RECORDED,
    activeConditions: profile?.activeConditions ?? [],
    pregnant: profile?.isPregnant ?? false,
    trimester: pregnancy?.trimester ?? 0,
    week: pregnancy?.week ?? 0,
    lmp: formatDate(pregnancy?.lmp),
    edd: formatDate(pregnancy?.edd),
    ancVisits: pregnancy?.ancVisits ?? 0,
    highRisk: pregnancy?.highRisk ?? false,
  }
}

/**
 * The signed-in patient's profile, loaded from `GET /patients/me`.
 *
 * Returns a stable object immediately (with `NOT_RECORDED` placeholders) and
 * swaps in real values once the query resolves, so callers never branch on
 * loading and never fall back to demo data.
 */
export function usePatientProfile(): PatientProfile {
  const { user } = useAuth()

  const { data } = useQuery({
    queryKey: [PROFILE_QUERY_KEY, user?.id],
    queryFn: () => patientService.getMyProfile(),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  })

  return useMemo(() => toProfile(data, user?.fullName), [data, user?.fullName])
}

/**
 * The raw `GET /patients/me` document behind `usePatientProfile` — same query
 * key, so both hooks share one request. Use this when you need the
 * unformatted fields (profile inputs, numeric vitals) rather than display
 * strings.
 */
export function useMyPatientProfile(): MyPatientProfile | undefined {
  const { user } = useAuth()

  const { data } = useQuery({
    queryKey: [PROFILE_QUERY_KEY, user?.id],
    queryFn: () => patientService.getMyProfile(),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  })

  return data
}
