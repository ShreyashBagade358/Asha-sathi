export type Role =
  | 'asha'
  | 'anm'
  | 'moic'
  | 'bpm'
  | 'dpm'
  | 'state_admin'
  | 'super_admin'

export type OrgLevel = 'state' | 'district' | 'block' | 'phc' | 'village'

export interface User {
  id: string
  role: Role
  fullName: string
  phone: string
  email?: string
  stateId: string
  stateName?: string
  districtId?: string
  districtName?: string
  blockId?: string
  blockName?: string
  phcId?: string
  phcName?: string
  villages?: string[]
  designation?: string
  active: boolean
  createdAt: string
  updatedAt?: string
  lastLoginAt?: string
}

export type Gender = 'male' | 'female' | 'transgender'
export type MaritalStatus = 'unmarried' | 'married' | 'widowed' | 'divorced'

export interface Beneficiary {
  id: string
  abhaId?: string
  name: string
  dob: string
  gender: Gender
  phone?: string
  village: string
  phcId: string
  ashaId?: string
  anmId?: string
  maritalStatus?: MaritalStatus
  bpl?: boolean
  isPregnant?: boolean
  hasChild?: boolean
  createdBy?: string
  createdAt: string
  updatedAt?: string
}

export type PregnancyStatus = 'active' | 'delivered' | 'aborted' | 'ltf'

export interface Pregnancy {
  id: string
  beneficiaryId: string
  lmp: string
  edd: string
  gravida: number
  para: number
  status: PregnancyStatus
  highRisk: boolean
  hrpLevel?: 'low' | 'medium' | 'high'
  complications: string[]
  registeredAt: string
  registeredBy?: string
  deliveredAt?: string
}

export interface ANCVisit {
  id: string
  pregnancyId: string
  beneficiaryId: string
  visitNumber: number
  date: string
  gestationWeek: number
  weightKg?: number
  bpSystolic?: number
  bpDiastolic?: number
  haemoglobin?: number
  fundalHeight?: number
  foetalHeartRate?: number
  hrpFlag: boolean
  attendedBy?: string
  facility?: string
}

export interface Child {
  id: string
  beneficiaryId: string
  name: string
  dob: string
  gender: Gender
  birthWeightKg?: number
  gestationalAgeWeeks?: number
  deliveryType: 'normal' | 'c-section' | 'assisted'
  bornAtFacility: boolean
  ashaId?: string
  phcId: string
}

export type ImmunizationStatus = 'due' | 'given' | 'overdue' | 'skipped'

export interface Immunization {
  id: string
  childId: string
  vaccineCode: string
  vaccineName: string
  doseNumber: number
  dueDate: string
  administeredDate?: string
  status: ImmunizationStatus
  administeredAt?: string
  facility?: string
}

export interface ASHAKPI {
  ashaId: string
  ashaName: string
  phcId: string
  village: string
  period: string
  pregnantWomenRegistered: number
  anc4PlusCompleted: number
  institutionalDeliveries: number
  immunizationCoverage: number
  hrpIdentified: number
  ncdScreened: number
  homeVisits: number
  incentiveEarned: number
  performanceScore: number
}

export interface Household {
  id: string
  householdId: string
  village: string
  ward?: string
  headName: string
  memberCount: number
  eligibleWomen: number
  childrenUnder5: number
  pregnantWomen: number
  lat?: number
  long?: number
  lastVisitedAt?: string
}

export type ReferralStatus = 'pending' | 'accepted' | 'completed' | 'cancelled'

export interface Referral {
  id: string
  beneficiaryId: string
  fromFacility: string
  toFacility: string
  reason: string
  urgency: 'routine' | 'urgent' | 'emergency'
  status: ReferralStatus
  referredBy: string
  referredAt: string
  completedAt?: string
}

export type NotificationType = 'alert' | 'sync' | 'system' | 'incentive'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  createdAt: string
}

export type IncentiveStatus = 'pending' | 'approved' | 'rejected' | 'paid'

export interface IncentiveClaim {
  id: string
  ashaId: string
  serviceType: string
  serviceDate: string
  beneficiaryId: string
  amount: number
  status: IncentiveStatus
  claimedAt: string
  approvedBy?: string
  approvedAt?: string
}

export interface DashboardKPIs {
  period: string
  totalPregnancies: number
  activePregnancies: number
  hrpActive: number
  anc4Coverage: number
  institutionalDeliveryRate: number
  immunizationCoverage: number
  ncdScreened: number
  ncdPositive: number
  homeVisits: number
  incentivesPaid: number
  ashaCount: number
  villageCount: number
  beneficiaryCount: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PHCComparisonRow {
  phcId: string
  phcName: string
  values: Record<string, number>
}

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved'

export type AlertType = 'hrp' | 'stockout' | 'sync' | 'outbreak'

export interface AlertItem {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  location?: string
  createdAt: string
  status: AlertStatus
}

export interface HRPAlert {
  id: string
  beneficiaryId: string
  beneficiaryName: string
  pregnancyId: string
  village: string
  ashaName: string
  hrpLevel: 'medium' | 'high'
  reason: string
  detectedAt: string
  status: AlertStatus
}

export type SyncStatus = 'success' | 'partial' | 'failed'

export interface SyncRecord {
  id: string
  ashaId: string
  ashaName: string
  deviceId: string
  syncedAt: string
  recordsSynced: number
  status: SyncStatus
  durationMs?: number
}

export type AuditActionType =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'config_change'
  | 'policy_change'
  | 'user_management'

export interface AuditLogEntry {
  id: string
  timestamp: string
  actorId: string
  actorName: string
  actorRole: Role
  action: AuditActionType
  resource: string
  resourceId?: string
  details: string
  ip?: string
  status: 'success' | 'denied' | 'error'
}
