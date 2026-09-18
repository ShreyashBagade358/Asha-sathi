import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppNotification,
  CheckUpRecord,
  ChildRecord,
  FollowUpRecord,
  Patient,
  PendingTask,
  PregnancyRecord,
  ReferralRecord,
  ReferralStatus,
} from '@/pages/asha/mockData'
import type { Appointment, HealthRecord, VaccineDose, PatientNotification } from '@/pages/patient/mockData'
import type { ASHAUser } from '@/services/asha.service'
import { PATIENT_PROFILE } from '@/pages/patient/mockData'

type NotificationAudience = 'asha' | 'patient'

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
  notifications: AppNotification[]
  patientNotifications: PatientNotification[]
  ashaWorkers: ASHAUser[]
  tasks: PendingTask[]

  addPatient: (patient: Patient) => void
  addCheckup: (checkup: CheckUpRecord) => void
  markDoseGiven: (scope: 'child' | 'mother', doseId: string) => void
  addPregnancy: (pregnancy: PregnancyRecord) => void
  addChild: (child: ChildRecord) => void
  addReferral: (referral: ReferralRecord) => void
  updateReferralStatus: (id: string, status: ReferralStatus) => void
  markFollowUpDone: (id: string) => void
  addFollowUp: (followUp: FollowUpRecord) => void
  bookAppointment: (appointment: Appointment) => void
  markNotificationRead: (audience: NotificationAudience, id: string) => void
  markAllNotificationsRead: (audience: NotificationAudience) => void
  publishNotification: (audience: NotificationAudience, data: Omit<AppNotification, 'id' | 'read' | 'time'> | Omit<PatientNotification, 'id' | 'read' | 'time'>) => void
  addAshaWorker: (worker: ASHAUser) => void
  addTask: (task: PendingTask) => void
  toggleTask: (id: string) => void
}

let seq = 0
const nextId = (prefix: string) => `${prefix}-${++seq}-${Date.now()}`

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
      notifications: [],
      patientNotifications: [],
      ashaWorkers: [],
      tasks: [],

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
              facility: `${checkup.village} Sub-centre`,
              doctor: 'ASHA Worker',
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

      markDoseGiven: (scope, doseId) =>
        set((s) => {
          const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          const key = scope === 'child' ? 'childVaccines' : 'motherVaccines'
          const patch = (dose: VaccineDose) =>
            dose.id === doseId ? { ...dose, status: 'given' as const, date: today } : dose
          return { [key]: s[key].map(patch) } as Partial<AppState>
        }),

      addPregnancy: (pregnancy) =>
        set((s) => ({
          pregnancies: [pregnancy, ...s.pregnancies],
          healthRecords: [
            {
              id: `hr-preg-${pregnancy.id}`,
              category: 'checkup' as const,
              title: 'Pregnancy Registration',
              date: pregnancy.lmp,
              facility: `${pregnancy.village} Sub-centre`,
              doctor: 'ASHA Worker',
              details: [
                { label: 'Patient', value: pregnancy.patientName },
                { label: 'ABHA ID', value: pregnancy.abhaId },
                { label: 'Trimester', value: `${pregnancy.trimester}` },
                { label: 'Week', value: `${pregnancy.week}` },
                { label: 'LMP', value: pregnancy.lmp },
                { label: 'EDD', value: pregnancy.edd },
                { label: 'ANC Visits', value: `${pregnancy.ancVisits}` },
                { label: 'Risk', value: pregnancy.risk },
                ...(pregnancy.riskReason ? [{ label: 'Risk Reason', value: pregnancy.riskReason }] : []),
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
              facility: `${child.village} Sub-centre`,
              doctor: 'ASHA Worker',
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

      addReferral: (referral) =>
        set((s) => ({
          referrals: [referral, ...s.referrals],
          tasks: [
            {
              id: `task-ref-${++seq}-${Date.now()}`,
              title: `Referral: ${referral.patientName}`,
              subtitle: `${referral.reason} → ${referral.toFacility}`,
              category: 'follow-up' as const,
              done: false,
              due: referral.date,
            },
            ...s.tasks,
          ],
        })),

      updateReferralStatus: (id, status) =>
        set((s) => ({ referrals: s.referrals.map((r) => (r.id === id ? { ...r, status } : r)) })),

      markFollowUpDone: (id) =>
        set((s) => ({
          followUps: s.followUps.map((f) => (f.id === id ? { ...f, status: 'completed' as const } : f)),
        })),

      addFollowUp: (followUp) => set((s) => ({ followUps: [followUp, ...s.followUps] })),

      bookAppointment: (appointment) => set((s) => ({ appointments: [appointment, ...s.appointments] })),

      markNotificationRead: (audience, id) =>
        set((s) => {
          if (audience === 'asha') {
            return { notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }
          }
          return { patientNotifications: s.patientNotifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }
        }),

      markAllNotificationsRead: (audience) =>
        set((s) => {
          if (audience === 'asha') {
            return { notifications: s.notifications.map((n) => ({ ...n, read: true })) }
          }
          return { patientNotifications: s.patientNotifications.map((n) => ({ ...n, read: true })) }
        }),

      publishNotification: (audience, data) =>
        set((s) => {
          const time = 'Just now'
          if (audience === 'asha') {
            return {
              notifications: [{ ...(data as Omit<AppNotification, 'id' | 'read' | 'time'>), id: nextId('n'), read: false, time }, ...s.notifications],
            }
          }
          return {
            patientNotifications: [
              { ...(data as Omit<PatientNotification, 'id' | 'read' | 'time'>), id: nextId('pn'), read: false, time },
              ...s.patientNotifications,
            ],
          }
        }),

      addAshaWorker: (worker) => set((s) => ({ ashaWorkers: [...s.ashaWorkers, worker] })),

      addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),

      toggleTask: (id) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
    }),
    { name: 'asha-sathi-store-v2' },
  ),
)

export const useASHAStore = useAppStore

export function newPatientId(): string {
  return `new-${++seq}-${Date.now()}`
}

export function patientPortalProfile(patients: Patient[]) {
  const p = patients.find((x) => x.id === '1') ?? patients[0]
  return {
    ...PATIENT_PROFILE,
    name: p?.name ?? PATIENT_PROFILE.name,
    abhaId: p?.abhaId ?? PATIENT_PROFILE.abhaId,
    age: p?.age ?? PATIENT_PROFILE.age,
    gender: p?.gender ?? PATIENT_PROFILE.gender,
    phone: p?.phone ?? PATIENT_PROFILE.phone,
    address: p?.address ?? PATIENT_PROFILE.address,
    village: p?.village ?? PATIENT_PROFILE.village,
    activeConditions: p?.activeConditions ?? PATIENT_PROFILE.activeConditions,
    pregnant: p?.pregnant ?? PATIENT_PROFILE.pregnant,
  }
}