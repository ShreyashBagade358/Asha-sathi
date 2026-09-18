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

export const PATIENT_PROFILE: PatientProfile = {
  id: 'me',
  name: 'Sita Devi',
  abhaId: 'BHF-2023-8942',
  age: 28,
  gender: 'Female',
  dob: '14 Mar 1998',
  bloodGroup: 'O+',
  phone: '+91 98765 43210',
  address: 'House 42, Ward 3, Village Rampur',
  village: 'Rampur',
  phc: 'PHC Rampur',
  ashaWorker: 'Meena Sharma',
  height: '158 cm',
  weight: '58.4 kg',
  latestBp: '138/92',
  haemoglobin: '9.6 g/dL',
  activeConditions: ['Severe Anemia', 'Pregnancy (Trimester 3)'],
  pregnant: true,
  trimester: 3,
  week: 32,
  lmp: '10 Apr 2026',
  edd: '15 Jan 2027',
  ancVisits: 5,
  highRisk: true,
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

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'a1',
    type: 'ANC Check-up',
    location: 'PHC Rampur',
    date: '20 Aug 2026',
    time: '9:30 AM',
    status: 'upcoming',
    doctor: 'Dr. Anita Verma',
  },
  {
    id: 'a2',
    type: 'Ultrasound Scan',
    location: 'District Hospital',
    date: '25 Aug 2026',
    time: '11:00 AM',
    status: 'upcoming',
  },
  {
    id: 'a3',
    type: 'Hemoglobin Test Follow-up',
    location: 'Rampur Sub-centre',
    date: '16 Aug 2026',
    time: '10:00 AM',
    status: 'past',
  },
  {
    id: 'a4',
    type: 'ANC Check-up',
    location: 'PHC Rampur',
    date: '02 Aug 2026',
    time: '9:30 AM',
    status: 'past',
    doctor: 'Dr. Anita Verma',
  },
]

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

export const MOCK_HEALTH_RECORDS: HealthRecord[] = [
  {
    id: 'r1',
    category: 'checkup',
    title: 'ANC Check-up',
    date: '16 Aug 2026',
    facility: 'Rampur Sub-centre',
    doctor: 'Dr. Anita Verma',
    details: [
      { label: 'Blood Pressure', value: '138/92 mmHg' },
      { label: 'Weight', value: '58.4 kg' },
      { label: 'Haemoglobin', value: '9.6 g/dL' },
      { label: 'Notes', value: 'Refer to PHC for anemia management.' },
    ],
  },
  {
    id: 'r2',
    category: 'prescription',
    title: 'IFA Tablets (Iron + Folic Acid)',
    date: '16 Aug 2026',
    facility: 'Rampur Sub-centre',
    doctor: 'Dr. Anita Verma',
    dose: '1 tab daily after food',
    duration: '90 days',
    details: [],
  },
  {
    id: 'r3',
    category: 'prescription',
    title: 'Calcium + Vitamin D3',
    date: '12 May 2026',
    facility: 'Rampur Sub-centre',
    doctor: 'Dr. Anita Verma',
    dose: '1 tab at night',
    duration: 'Until delivery',
    details: [],
  },
  {
    id: 'r4',
    category: 'lab',
    title: 'Complete Blood Count',
    date: '16 Aug 2026',
    facility: 'PHC Rampur Lab',
    details: [
      { label: 'Haemoglobin', value: '9.6 g/dL' },
      { label: 'Total WBC', value: '7,800 /µL' },
      { label: 'Platelets', value: '2.4 L /µL' },
    ],
    downloadable: true,
  },
  {
    id: 'r5',
    category: 'lab',
    title: 'Blood Group & Rh',
    date: '12 Oct 2023',
    facility: 'PHC Rampur Lab',
    details: [{ label: 'Blood Group', value: 'O Positive' }],
    downloadable: true,
  },
  {
    id: 'r6',
    category: 'checkup',
    title: 'Registration Check-up',
    date: '12 Oct 2023',
    facility: 'PHC Rampur',
    doctor: 'Dr. Rakesh Sinha',
    details: [
      { label: 'Blood Pressure', value: '118/76 mmHg' },
      { label: 'Weight', value: '52.1 kg' },
      { label: 'Notes', value: 'Registered under JSY for institutional delivery.' },
    ],
  },
]

export type DoseStatus = 'given' | 'due' | 'overdue' | 'upcoming'

export interface VaccineDose {
  id: string
  name: string
  vaccines: string
  date: string
  status: DoseStatus
}

export const CHILD_VACCINES: VaccineDose[] = [
  { id: 'c1', name: 'Birth Dose', vaccines: 'BCG, OPV-0, Hep B', date: '22 May 2025', status: 'given' },
  { id: 'c2', name: '6 Weeks', vaccines: 'OPV-1, Pentavalent-1, Rotavirus-1', date: '03 Jul 2025', status: 'given' },
  { id: 'c3', name: '10 Weeks', vaccines: 'OPV-2, Pentavalent-2, Rotavirus-2', date: '31 Jul 2025', status: 'given' },
  { id: 'c4', name: '14 Weeks', vaccines: 'OPV-3, Pentavalent-3, IPV', date: '28 Aug 2025', status: 'given' },
  { id: 'c5', name: '9 Months', vaccines: 'Measles-Rubella, Vitamin A', date: '22 Feb 2026', status: 'given' },
  { id: 'c6', name: '16–24 Months', vaccines: 'DPT Booster, OPV Booster, MR-2', date: '15 Sep 2026', status: 'due' },
  { id: 'c7', name: '5 Years', vaccines: 'DPT Booster-2', date: '22 May 2030', status: 'upcoming' },
]

export const MOTHER_VACCINES: VaccineDose[] = [
  { id: 'm1', name: 'TT-1', vaccines: 'Tetanus Toxoid', date: '12 May 2026', status: 'given' },
  { id: 'm2', name: 'TT-2', vaccines: 'Tetanus Toxoid', date: '12 Jul 2026', status: 'given' },
  { id: 'm3', name: 'TT Booster', vaccines: 'Tetanus Toxoid', date: 'Due at delivery', status: 'upcoming' },
]

export type PatientReferralStatus = 'pending' | 'accepted' | 'completed' | 'cancelled'
export type PatientReferralUrgency = 'routine' | 'urgent' | 'emergency'

export interface PatientReferral {
  id: string
  toFacility: string
  reason: string
  urgency: PatientReferralUrgency
  date: string
  status: PatientReferralStatus
  referredBy: string
}

export const MOCK_PATIENT_REFERRALS: PatientReferral[] = [
  {
    id: 'ref1',
    toFacility: 'PHC Rampur',
    reason: 'Severe anemia with high-risk pregnancy',
    urgency: 'urgent',
    date: '18 Aug 2026',
    status: 'pending',
    referredBy: 'Meena Sharma (ASHA)',
  },
  {
    id: 'ref2',
    toFacility: 'District Hospital',
    reason: 'Ultrasound scan for foetal growth assessment',
    urgency: 'routine',
    date: '10 Jul 2026',
    status: 'completed',
    referredBy: 'Dr. Anita Verma (MOIC)',
  },
]

export type PatientNotifType = 'appointment' | 'referral' | 'health' | 'system'

export interface PatientNotification {
  id: string
  type: PatientNotifType
  title: string
  message: string
  time: string
  read: boolean
}

export const MOCK_PATIENT_NOTIFICATIONS: PatientNotification[] = [
  {
    id: 'n1',
    type: 'appointment',
    title: 'Appointment Reminder',
    message: 'Your ANC check-up at PHC Rampur is on 20 Aug at 9:30 AM.',
    time: '2 hrs ago',
    read: false,
  },
  {
    id: 'n2',
    type: 'health',
    title: 'IFA Tablets Reminder',
    message: 'Remember to take your IFA tablet today after food.',
    time: '3 hrs ago',
    read: false,
  },
  {
    id: 'n3',
    type: 'referral',
    title: 'Referral Accepted',
    message: 'Your referral to PHC Rampur was accepted. Carry your previous reports.',
    time: '1 day ago',
    read: false,
  },
  {
    id: 'n4',
    type: 'system',
    title: 'Health Record Updated',
    message: 'Your ABHA health record was updated after the last check-up.',
    time: 'Yesterday',
    read: true,
  },
  {
    id: 'n5',
    type: 'appointment',
    title: 'Check-up Completed',
    message: 'Your hemoglobin test result is available in Health Records.',
    time: 'Yesterday',
    read: true,
  },
]
