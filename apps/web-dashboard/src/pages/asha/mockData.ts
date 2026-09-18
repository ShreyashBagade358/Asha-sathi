export type RiskLevel = 'low' | 'medium' | 'high'

export interface Patient {
  id: string
  name: string
  abhaId: string
  age: number
  gender: string
  bloodGroup: string
  phone: string
  address: string
  village: string
  ward: string
  risk: RiskLevel
  riskReason?: string
  trimester?: string
  pregnant?: boolean
  registeredAt: string
  activeConditions: string[]
}

export interface HouseholdMember {
  id: string
  name: string
  relation: string
  age: number
  gender: string
  risk?: RiskLevel
  flag?: string
  isHoh?: boolean
}

export interface Household {
  id: string
  headName: string
  familySize: number
  village: string
  lastVisitDays: number
  status: 'visit-due' | 'follow-up' | 'scheduled'
  priority: RiskLevel
  note?: string
  nextVisit?: string
  members: HouseholdMember[]
}

export interface PendingTask {
  id: string
  title: string
  subtitle: string
  category: 'visit' | 'due' | 'follow-up'
  done: boolean
  due: string
}

export interface VisitItem {
  id: string
  type: string
  name: string
  location: string
  time: string
}

export interface AlertItem {
  id: string
  level: string
  overdue: string
  name: string
  meta: string
  action: string
  accent: RiskLevel
}

export interface ImmunizationDose {
  id: string
  name: string
  vaccines: string
  date: string
  status: 'done' | 'current' | 'upcoming' | 'overdue'
}

export const MOCK_PATIENTS: Patient[] = [
  {
    id: '1',
    name: 'Sita Devi',
    abhaId: 'BHF-2023-8942',
    age: 28,
    gender: 'Female',
    bloodGroup: 'O+',
    phone: '+91 98765 43210',
    address: 'House 42, Ward 3, Village Rampur',
    village: 'Rampur',
    ward: 'Ward 3',
    risk: 'high',
    riskReason: 'Severe Anemia',
    pregnant: true,
    trimester: '3rd Trimester',
    registeredAt: '12 Oct 2023',
    activeConditions: ['Severe Anemia', 'Pregnancy (Trimester 3)'],
  },
  {
    id: '2',
    name: 'Ramesh Kumar',
    abhaId: 'BHF-2023-8890',
    age: 45,
    gender: 'Male',
    bloodGroup: 'O+',
    phone: '+91 98765 43211',
    address: 'House 12, Ward 1, Village Rampur',
    village: 'Rampur',
    ward: 'Ward 1',
    risk: 'medium',
    riskReason: 'High BP Monitoring',
    registeredAt: '08 Oct 2023',
    activeConditions: ['Hypertension'],
  },
  {
    id: '3',
    name: 'Anjali Devi',
    abhaId: 'BHF-2023-8876',
    age: 26,
    gender: 'Female',
    bloodGroup: 'B+',
    phone: '+91 98765 43212',
    address: 'House 7, Ward 4, Village Sitapur',
    village: 'Sitapur',
    ward: 'Ward 4',
    risk: 'high',
    riskReason: 'Elevated BP',
    pregnant: true,
    trimester: '3rd Trimester',
    registeredAt: '02 Oct 2023',
    activeConditions: ['Elevated Blood Pressure', 'Pregnancy (Trimester 3)'],
  },
  {
    id: '4',
    name: 'Rohan Sharma',
    abhaId: 'BHF-2023-8861',
    age: 7,
    gender: 'Male',
    bloodGroup: 'A+',
    phone: '+91 98765 43213',
    address: 'House 3, Ward 2, Village Sitapur',
    village: 'Sitapur',
    ward: 'Ward 2',
    risk: 'low',
    registeredAt: '28 Sep 2023',
    activeConditions: [],
  },
]

export const MOCK_HOUSEHOLDS: Household[] = [
  {
    id: 'HH-2023-8942',
    headName: 'Ramesh Kumar',
    familySize: 6,
    village: 'Rampur',
    lastVisitDays: 14,
    status: 'visit-due',
    priority: 'high',
    note: 'Antenatal care needed',
    members: [
      { id: 'm1', name: 'Ramesh Kumar', relation: 'Head of Household', age: 45, gender: 'Male', isHoh: true },
      { id: 'm2', name: 'Sunita Devi', relation: 'Wife', age: 40, gender: 'Female', risk: 'high', flag: 'Pregnant' },
      { id: 'm3', name: 'Amit Kumar', relation: 'Son', age: 4, gender: 'Male', flag: 'Immunization Due' },
    ],
  },
  {
    id: 'HH-2023-8890',
    headName: 'Sunita Devi',
    familySize: 4,
    village: 'Sitapur',
    lastVisitDays: 3,
    status: 'follow-up',
    priority: 'medium',
    note: 'Routine check',
    members: [
      { id: 'm4', name: 'Sunita Devi', relation: 'Head of Household', age: 38, gender: 'Female', isHoh: true },
      { id: 'm5', name: 'Arjun Devi', relation: 'Son', age: 9, gender: 'Male' },
    ],
  },
  {
    id: 'HH-2023-8871',
    headName: 'Anil Sharma',
    familySize: 3,
    village: 'Lakshmanpur',
    lastVisitDays: 0,
    status: 'scheduled',
    priority: 'low',
    nextVisit: 'Tomorrow',
    members: [
      { id: 'm6', name: 'Anil Sharma', relation: 'Head of Household', age: 52, gender: 'Male', isHoh: true },
      { id: 'm7', name: 'Meena Sharma', relation: 'Wife', age: 47, gender: 'Female' },
    ],
  },
]

export const INITIAL_TASKS: PendingTask[] = [
  { id: 't1', title: 'Polio Vaccine Due', subtitle: 'Rahul (6 months) • Ward 2', category: 'due', done: false, due: 'Today' },
  { id: 't2', title: 'IFA Tablets Distribution', subtitle: 'Sita Devi • Ward 1', category: 'visit', done: false, due: 'Today' },
  { id: 't3', title: 'Postnatal Follow-up', subtitle: 'Meena Kumari • Ward 5', category: 'follow-up', done: false, due: 'Tomorrow' },
  { id: 't4', title: 'ANC Checkup', subtitle: 'Sunita Patel • Ward 3', category: 'visit', done: true, due: 'Completed' },
]

export const MOCK_VISITS: VisitItem[] = [
  { id: 'v1', type: 'ANC Checkup', name: 'Sunita Patel', location: 'Ward 3, Main Street', time: '9:30 AM' },
  { id: 'v2', type: 'Newborn Visit', name: 'Meena Kumari', location: 'Ward 5, East Colony', time: '11:00 AM' },
]

export const MOCK_ALERTS: AlertItem[] = [
  {
    id: 'a1',
    level: 'High BP',
    overdue: '2 days overdue',
    name: 'Anjali Devi',
    meta: '3rd Trimester • Ward 4',
    action: 'Follow Up Now',
    accent: 'high',
  },
  {
    id: 'a2',
    level: 'Severe Malnutrition',
    overdue: 'Today',
    name: 'Raju Kumar',
    meta: '2 years • Ward 1',
    action: 'Review Status',
    accent: 'medium',
  },
]

export const IMMUNIZATION_DOSES: ImmunizationDose[] = [
  { id: 'd1', name: 'Birth Dose', vaccines: 'BCG, OPV-0, Hep B', date: 'Oct 12, 2023', status: 'done' },
  { id: 'd2', name: '6 Weeks', vaccines: 'OPV-1, Pentavalent-1, Rotavirus-1', date: 'Nov 23, 2023', status: 'done' },
  { id: 'd3', name: '10 Weeks (Current)', vaccines: 'OPV-2, Pentavalent-2, Rotavirus-2', date: 'Dec 21, 2023', status: 'current' },
  { id: 'd4', name: '14 Weeks', vaccines: 'OPV-3, Pentavalent-3, IPV', date: 'Jan 05, 2024', status: 'overdue' },
]

export type SyncQueueState = 'stored' | 'syncing' | 'failed' | 'synced'

export interface SyncQueueItem {
  id: string
  title: string
  form: string
  state: SyncQueueState
}

export const SYNC_QUEUE: SyncQueueItem[] = [
  { id: 's1', title: 'Ramesh Household Visit', form: 'Routine Follow-up', state: 'syncing' },
  { id: 's2', title: 'Anita Devi ANC Checkup', form: 'Trimester 2', state: 'stored' },
  { id: 's3', title: 'Sunita Newborn Reg.', form: 'Error: Network timeout', state: 'failed' },
]

export type SurveyStatus = 'completed' | 'in-progress' | 'pending'

export interface HealthSurvey {
  id: string
  householdId: string
  headName: string
  village: string
  date: string
  status: SurveyStatus
  cleanWater: boolean
  functionalToilet: boolean
  recentFever: boolean
  membersScreened: number
  familySize: number
}

export const MOCK_SURVEYS: HealthSurvey[] = [
  {
    id: 'srv1',
    householdId: 'HH-2023-8942',
    headName: 'Ramesh Kumar',
    village: 'Rampur',
    date: '18 Aug 2026',
    status: 'completed',
    cleanWater: true,
    functionalToilet: true,
    recentFever: false,
    membersScreened: 6,
    familySize: 6,
  },
  {
    id: 'srv2',
    householdId: 'HH-2023-8890',
    headName: 'Sunita Devi',
    village: 'Sitapur',
    date: '17 Aug 2026',
    status: 'in-progress',
    cleanWater: true,
    functionalToilet: false,
    recentFever: true,
    membersScreened: 2,
    familySize: 4,
  },
  {
    id: 'srv3',
    householdId: 'HH-2023-8871',
    headName: 'Anil Sharma',
    village: 'Lakshmanpur',
    date: 'Scheduled',
    status: 'pending',
    cleanWater: false,
    functionalToilet: false,
    recentFever: false,
    membersScreened: 0,
    familySize: 3,
  },
]

export type PregnancyStatus = 'active' | 'delivered' | 'ltf'

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

export const MOCK_PREGNANCIES: PregnancyRecord[] = [
  {
    id: 'p1',
    patientName: 'Sita Devi',
    abhaId: 'BHF-2023-8942',
    village: 'Rampur',
    ward: 'Ward 3',
    lmp: '10 Apr 2026',
    edd: '15 Jan 2027',
    trimester: 3,
    week: 32,
    risk: 'high',
    riskReason: 'Severe Anemia',
    ancVisits: 5,
    status: 'active',
  },
  {
    id: 'p2',
    patientName: 'Anjali Devi',
    abhaId: 'BHF-2023-8876',
    village: 'Sitapur',
    ward: 'Ward 4',
    lmp: '22 Apr 2026',
    edd: '27 Jan 2027',
    trimester: 3,
    week: 30,
    risk: 'high',
    riskReason: 'Elevated Blood Pressure',
    ancVisits: 4,
    status: 'active',
  },
  {
    id: 'p3',
    patientName: 'Meena Kumari',
    abhaId: 'BHF-2023-8810',
    village: 'Rampur',
    ward: 'Ward 5',
    lmp: '12 Jul 2026',
    edd: '17 Apr 2027',
    trimester: 1,
    week: 12,
    risk: 'low',
    ancVisits: 2,
    status: 'active',
  },
  {
    id: 'p4',
    patientName: 'Sunita Patel',
    abhaId: 'BHF-2023-8702',
    village: 'Lakshmanpur',
    ward: 'Ward 2',
    lmp: '01 Nov 2025',
    edd: '08 Aug 2026',
    trimester: 3,
    week: 40,
    risk: 'medium',
    riskReason: 'Gestational Diabetes',
    ancVisits: 8,
    status: 'delivered',
  },
]

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

export const MOCK_CHILDREN: ChildRecord[] = [
  {
    id: 'c1',
    name: 'Rahul Kumar',
    parentName: 'Ramesh Kumar',
    gender: 'Male',
    dob: '22 May 2025',
    ageMonths: 15,
    weightKg: 9.2,
    heightCm: 76,
    immunizationDone: 5,
    immunizationTotal: 6,
    status: 'healthy',
    village: 'Rampur',
  },
  {
    id: 'c2',
    name: 'Priya Devi',
    parentName: 'Sunita Devi',
    gender: 'Female',
    dob: '02 Feb 2026',
    ageMonths: 6,
    weightKg: 5.8,
    heightCm: 62,
    immunizationDone: 2,
    immunizationTotal: 3,
    status: 'underweight',
    village: 'Sitapur',
  },
  {
    id: 'c3',
    name: 'Raju Kumar',
    parentName: 'Anil Sharma',
    gender: 'Male',
    dob: '14 Oct 2024',
    ageMonths: 22,
    weightKg: 8.9,
    heightCm: 80,
    immunizationDone: 4,
    immunizationTotal: 4,
    status: 'malnourished',
    village: 'Lakshmanpur',
  },
  {
    id: 'c4',
    name: 'Amit Kumar',
    parentName: 'Ramesh Kumar',
    gender: 'Male',
    dob: '10 Aug 2025',
    ageMonths: 12,
    weightKg: 8.6,
    heightCm: 74,
    immunizationDone: 3,
    immunizationTotal: 4,
    status: 'healthy',
    village: 'Rampur',
  },
]

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

export const MOCK_CHECKUPS: CheckUpRecord[] = [
  {
    id: 'chk1',
    patientName: 'Sita Devi',
    age: 28,
    gender: 'Female',
    village: 'Rampur',
    date: '18 Aug 2026',
    bpSystolic: 138,
    bpDiastolic: 92,
    weightKg: 58.4,
    haemoglobin: 9.6,
    temperature: 98.6,
    pulseRate: 86,
    risk: 'high',
    notes: 'Refer to PHC for anemia management.',
  },
  {
    id: 'chk2',
    patientName: 'Ramesh Kumar',
    age: 45,
    gender: 'Male',
    village: 'Rampur',
    date: '16 Aug 2026',
    bpSystolic: 142,
    bpDiastolic: 96,
    weightKg: 72.1,
    temperature: 98.4,
    pulseRate: 78,
    risk: 'medium',
    notes: 'Continue hypertension medication.',
  },
  {
    id: 'chk3',
    patientName: 'Anjali Devi',
    age: 26,
    gender: 'Female',
    village: 'Sitapur',
    date: '15 Aug 2026',
    bpSystolic: 126,
    bpDiastolic: 82,
    weightKg: 54.8,
    haemoglobin: 10.8,
    temperature: 98.8,
    pulseRate: 80,
    risk: 'low',
  },
  {
    id: 'chk4',
    patientName: 'Rohan Sharma',
    age: 7,
    gender: 'Male',
    village: 'Sitapur',
    date: '14 Aug 2026',
    bpSystolic: 98,
    bpDiastolic: 62,
    weightKg: 21.5,
    temperature: 98.2,
    pulseRate: 92,
    risk: 'low',
  },
]

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

export const MOCK_REFERRALS: ReferralRecord[] = [
  {
    id: 'ref1',
    patientName: 'Sita Devi',
    age: 28,
    fromFacility: 'Rampur Sub-centre',
    toFacility: 'PHC Rampur',
    reason: 'Severe anemia with high-risk pregnancy',
    urgency: 'urgent',
    date: '18 Aug 2026',
    status: 'pending',
    referredBy: 'Meena Sharma (ASHA)',
  },
  {
    id: 'ref2',
    patientName: 'Ramesh Kumar',
    age: 45,
    fromFacility: 'Rampur Sub-centre',
    toFacility: 'District Hospital',
    reason: 'Uncontrolled hypertension',
    urgency: 'emergency',
    date: '16 Aug 2026',
    status: 'accepted',
    referredBy: 'Meena Sharma (ASHA)',
  },
  {
    id: 'ref3',
    patientName: 'Raju Kumar',
    age: 2,
    fromFacility: 'Lakshmanpur Sub-centre',
    toFacility: 'Nutrition Rehabilitation Centre',
    reason: 'Severe acute malnutrition',
    urgency: 'routine',
    date: '12 Aug 2026',
    status: 'completed',
    referredBy: 'Meena Sharma (ASHA)',
  },
]

export type FollowUpStatus = 'scheduled' | 'completed' | 'overdue'

export interface FollowUpRecord {
  id: string
  patientName: string
  type: string
  due: string
  status: FollowUpStatus
  notes?: string
}

export const MOCK_FOLLOWUPS: FollowUpRecord[] = [
  {
    id: 'fu1',
    patientName: 'Meena Kumari',
    type: 'Postnatal Follow-up',
    due: 'Today',
    status: 'scheduled',
    notes: 'Check incision healing and breast feeding.',
  },
  {
    id: 'fu2',
    patientName: 'Rahul Kumar',
    type: 'Polio Vaccination Due',
    due: 'Today',
    status: 'scheduled',
  },
  {
    id: 'fu3',
    patientName: 'Sita Devi',
    type: 'ANC Check-up',
    due: 'Tomorrow',
    status: 'scheduled',
    notes: 'Carry previous blood reports.',
  },
  {
    id: 'fu4',
    patientName: 'Anjali Devi',
    type: 'BP Monitoring',
    due: '3 days ago',
    status: 'overdue',
    notes: 'Elevated BP — needs immediate reassessment.',
  },
  {
    id: 'fu5',
    patientName: 'Ramesh Kumar',
    type: 'Hypertension Review',
    due: '5 days ago',
    status: 'completed',
  },
]

export type NotificationType = 'alert' | 'task' | 'system' | 'sync'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  time: string
  read: boolean
}

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    type: 'alert',
    title: 'HRP Escalation',
    message: 'Anjali Devi (Sitapur) BP 138/92 — high-risk pregnancy needs review.',
    time: '10 min ago',
    read: false,
  },
  {
    id: 'n2',
    type: 'task',
    title: 'Polio Vaccine Due',
    message: 'Rahul Kumar (Ward 2) is due for Polio vaccine today.',
    time: '1 hr ago',
    read: false,
  },
  {
    id: 'n3',
    type: 'sync',
    title: 'Sync Failure',
    message: '3 pending records failed to sync. Open Sync Center to retry.',
    time: '2 hrs ago',
    read: false,
  },
  {
    id: 'n4',
    type: 'system',
    title: 'New Monthly Report Ready',
    message: 'August performance report is now available for review.',
    time: '5 hrs ago',
    read: true,
  },
  {
    id: 'n5',
    type: 'task',
    title: 'Postnatal Follow-up',
    message: 'Meena Kumari (Ward 5) scheduled for postnatal visit.',
    time: 'Yesterday',
    read: true,
  },
  {
    id: 'n6',
    type: 'alert',
    title: 'Malnutrition Alert',
    message: 'Raju Kumar (Lakshmanpur) flagged as severely malnourished.',
    time: 'Yesterday',
    read: true,
  },
]
