export type RiskLevel = 'low' | 'medium' | 'high'

export interface PendingTask {
  id: string
  title: string
  subtitle: string
  category: 'visit' | 'due' | 'follow-up'
  done: boolean
  due: string
}

export type PregnancyStatus = 'active' | 'delivered' | 'aborted' | 'ltf'

export interface PregnancyRecord {
  id: string
  patientName: string
  abhaId: string
  village: string
  ward: string
  lmp: string
  edd: string
  trimester: number
  week: number
  risk: RiskLevel
  riskReason?: string
  ancVisits: number
  status: PregnancyStatus
}

export type ChildHealthStatus = 'healthy' | 'underweight' | 'malnourished'

export interface ChildRecord {
  id: string
  name: string
  parentName: string
  gender: string
  dob: string
  ageMonths: number
  weightKg: number
  heightCm: number
  immunizationDone: number
  immunizationTotal: number
  status: ChildHealthStatus
  village: string
}

export interface CheckUpRecord {
  id: string
  patientName: string
  age: number
  gender: string
  village: string
  date: string
  bpSystolic: number
  bpDiastolic: number
  weightKg: number
  haemoglobin?: number
  temperature: number
  pulseRate: number
  risk: RiskLevel
  notes?: string
}

export type ReferralStatus = 'pending' | 'accepted' | 'completed' | 'cancelled'
export type ReferralUrgency = 'routine' | 'urgent' | 'emergency'

export interface ReferralRecord {
  id: string
  patientName: string
  age: number
  fromFacility: string
  toFacility: string
  reason: string
  urgency: ReferralUrgency
  date: string
  status: ReferralStatus
  referredBy: string
}

export type FollowUpStatus = 'scheduled' | 'completed' | 'overdue'

export interface FollowUpRecord {
  id: string
  patientName: string
  type: string
  due: string
  status: FollowUpStatus
  notes?: string
}

export type NotificationType = 'alert' | 'task' | 'system' | 'sync'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  time: string
  read: boolean
}

export interface Patient {
  id: string
  beneficiaryId?: string
  name: string
  abhaId: string
  age: number
  gender: string
  bloodGroup: string
  phone: string
  address: string
  village: string
  ward: string
  householdId?: string
  risk: RiskLevel
  riskReason?: string
  trimester?: string
  pregnant?: boolean
  registeredAt: string
  activeConditions: string[]
}
