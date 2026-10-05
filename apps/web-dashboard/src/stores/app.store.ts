import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  CheckUpRecord,
  ChildRecord,
  FollowUpRecord,
  Patient,
  PregnancyRecord,
  ReferralRecord,
} from '@/pages/asha/mockData'
import type { Appointment, HealthRecord, VaccineDose } from '@/pages/patient/mockData'
import { NOT_RECORDED } from '@/hooks/usePatientProfile'
import type { ASHAUser } from '@/services/asha.service'

interface AppState {
  patients: Patient[]
  checkups: CheckUpRecord[]
  childVaccines: VaccineDose[]
  motherVaccines: VaccineDose[]
  pregnancies: PregnancyRecord[]
  children: ChildRecord[]
  referrals: ReferralRecord[]
  followUps: FollowUpRecord[]
  appointments: Appointment[]
  healthRecords: HealthRecord[]
  ashaWorkers: ASHAUser[]

  addPatient: (patient: Patient) => void
  addCheckup: (checkup: CheckUpRecord) => void
  addChild: (child: ChildRecord) => void
  addReferral: (referral: ReferralRecord) => void
  markFollowUpDone: (id: string) => void
  addAshaWorker: (worker: ASHAUser) => void
}

let seq = 0

/**
 * Rows this store creates at runtime always carry a prefixed, timestamped id
 * (`new-…`, `task-ref-…`, `hr-…`, `ref-…`). The mock seeds that used to be
 * persisted under this key had bare or short sequential ids (`1`, `t1`, `a1`,
 * `r1`, `ref1`). Dropping those on migrate clears leftover fake rows without
 * discarding anything a real user entered.
 */
const LEGACY_MOCK_ID = /^(?:\d+|[a-z]{1,2}\d+|ref\d+|HH-[\w-]+)$/

function isLegacyMockRow(row: unknown): boolean {
  return typeof row === 'object' && row !== null && LEGACY_MOCK_ID.test(String((row as { id?: unknown }).id ?? ''))
}

function dropLegacyMockRows<T extends { id: string }>(rows: T[] | undefined): T[] {
  return Array.isArray(rows) ? rows.filter((row) => !isLegacyMockRow(row)) : []
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      patients: [],
      checkups: [],
      childVaccines: [],
      motherVaccines: [],
      pregnancies: [],
      children: [],
      referrals: [],
      followUps: [],
      appointments: [],
      healthRecords: [],
      ashaWorkers: [],

      addPatient: (patient) =>
        set((s) => ({ patients: [...s.patients, patient] })),

      addCheckup: (checkup) =>
        set((s) => ({
          checkups: [checkup, ...s.checkups],
          healthRecords: [
            {
              id: `hr-${checkup.id}`,
              category: 'checkup',
              title: 'Health Check-up',
              date: checkup.date,
              facility: NOT_RECORDED,
              doctor: NOT_RECORDED,
              details: [
                { label: 'Blood Pressure', value: `${checkup.bpSystolic}/${checkup.bpDiastolic} mmHg` },
                { label: 'Weight', value: `${checkup.weightKg} kg` },
                { label: 'Temperature', value: `${checkup.temperature}°F` },
                { label: 'Pulse Rate', value: `${checkup.pulseRate} /min` },
                ...(checkup.haemoglobin !== undefined ? [{ label: 'Haemoglobin', value: `${checkup.haemoglobin} g/dL` }] : []),
                ...(checkup.notes ? [{ label: 'Notes', value: checkup.notes }] : []),
              ],
            },
            ...s.healthRecords,
          ],
        })),

      addChild: (child) =>
        set((s) => ({
          children: [child, ...s.children],
          healthRecords: [
            {
              id: `hr-child-${child.id}`,
              category: 'checkup' as const,
              title: 'Child Health Registration',
              date: child.dob,
              facility: NOT_RECORDED,
              doctor: NOT_RECORDED,
              details: [
                { label: 'Child', value: child.name },
                { label: 'Parent', value: child.parentName },
                { label: 'Gender', value: child.gender },
                { label: 'Date of Birth', value: child.dob },
                { label: 'Age', value: `${child.ageMonths} months` },
                { label: 'Weight', value: `${child.weightKg} kg` },
                { label: 'Height', value: `${child.heightCm} cm` },
                { label: 'Immunization', value: `${child.immunizationDone}/${child.immunizationTotal} done` },
                { label: 'Status', value: child.status },
              ],
            },
            ...s.healthRecords,
          ],
        })),

      addReferral: (referral) => set((s) => ({ referrals: [referral, ...s.referrals] })),

      markFollowUpDone: (id) =>
        set((s) => ({
          followUps: s.followUps.map((f) => (f.id === id ? { ...f, status: 'completed' as const } : f)),
        })),

      addAshaWorker: (worker) => set((s) => ({ ashaWorkers: [...s.ashaWorkers, worker] })),
    }),
    {
      name: 'asha-sathi-store-v2',
      version: 2,
      migrate: (persisted) => {
        const state = persisted as Partial<AppState>
        return {
          ...state,
          patients: dropLegacyMockRows(state.patients),
          checkups: dropLegacyMockRows(state.checkups),
          childVaccines: dropLegacyMockRows(state.childVaccines),
          motherVaccines: dropLegacyMockRows(state.motherVaccines),
          pregnancies: dropLegacyMockRows(state.pregnancies),
          children: dropLegacyMockRows(state.children),
          referrals: dropLegacyMockRows(state.referrals),
          followUps: dropLegacyMockRows(state.followUps),
          appointments: dropLegacyMockRows(state.appointments),
          healthRecords: dropLegacyMockRows(state.healthRecords),
        } as AppState
      },
    },
  ),
)

export const useASHAStore = useAppStore

export function newPatientId(): string {
  return `new-${++seq}-${Date.now()}`
}