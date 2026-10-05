export interface PatientProfile {
  id: string
  name: string
  abhaId: string
  age: number
  gender: string
  dob: string
  bloodGroup: string
  phone: string
  address: string
  village: string
  phc: string
  ashaWorker: string
  height: string
  weight: string
  latestBp: string
  haemoglobin: string
  activeConditions: string[]
  pregnant: boolean
  trimester: number
  week: number
  lmp: string
  edd: string
  ancVisits: number
  highRisk: boolean
}

export type AppointmentStatus = 'upcoming' | 'past'

export interface Appointment {
  id: string
  type: string
  location: string
  date: string
  time: string
  status: AppointmentStatus
  doctor?: string
}

export type HealthRecordCategory = 'checkup' | 'prescription' | 'lab'

export interface HealthRecord {
  id: string
  category: HealthRecordCategory
  title: string
  date: string
  facility: string
  details: { label: string; value: string }[]
  doctor?: string
  dose?: string
  duration?: string
  downloadable?: boolean
}

export type DoseStatus = 'given' | 'due' | 'overdue' | 'upcoming'

export interface VaccineDose {
  id: string
  name: string
  vaccines: string
  date: string
  status: DoseStatus
}

export type PatientReferralStatus = 'pending' | 'accepted' | 'completed' | 'cancelled'
export type PatientReferralUrgency = 'routine' | 'urgent' | 'emergency'

export type PatientNotifType = 'appointment' | 'referral' | 'health' | 'system'

export interface PatientNotification {
  id: string
  type: PatientNotifType
  title: string
  message: string
  time: string
  read: boolean
}
