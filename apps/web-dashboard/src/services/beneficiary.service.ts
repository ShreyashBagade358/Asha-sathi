import { api } from '@/lib/api'
import type {
  ANCVisit,
  Beneficiary,
  Child,
  Immunization,
  Paginated,
  Pregnancy,
} from '@/types'

export type BeneficiaryStatus = 'pregnant' | 'postnatal' | 'child' | 'eligible'

export interface BeneficiaryListParams {
  search?: string
  village?: string
  status?: BeneficiaryStatus | 'all'
  hasAbha?: boolean
  page?: number
  pageSize?: number
}

export interface BeneficiaryTimeline {
  beneficiary: Beneficiary
  pregnancies: Pregnancy[]
  ancVisits: ANCVisit[]
  children: Child[]
  immunizations: Immunization[]
}

const VILLAGES = ['Rampur', 'Sonpur', 'Kandwa', 'Tikari', 'Basari']

function dateOffset(days: number): string {
  return new Date(Date.now() - days * 864e5).toISOString()
}

const FALLBACK_BENEFICIARIES: Beneficiary[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `ben-${i + 1}`,
  abhaId: i % 3 === 0 ? `91-1000-${100000 + i * 173}` : undefined,
  name: ['Sunita Devi', 'Kamla Kumari', 'Rekha Devi', 'Anju Kumari', 'Poonam Devi', 'Maya Devi', 'Sita Devi', 'Lata Kumari', 'Rina Devi', 'Nisha Kumari', 'Usha Devi', 'Pinki Kumari'][i],
  dob: dateOffset(30000 - i * 400),
  gender: 'female',
  phone: `98${String(7654321 + i * 11).padStart(8, '0')}`,
  village: VILLAGES[i % VILLAGES.length],
  phcId: 'phc-demo',
  ashaId: `asha-${(i % 5) + 1}`,
  maritalStatus: 'married',
  bpl: i % 4 === 0,
  isPregnant: i % 3 === 0,
  hasChild: i % 2 === 0,
  createdAt: dateOffset(200 - i * 12),
}))

interface RawBeneficiary {
  id: string
  beneficiary_id: string
  household_id?: string | null
  abha_id?: string | null
  full_name: string
  gender?: string | null
  date_of_birth?: string | null
  phone?: string | null
  marital_status?: string | null
  is_pregnant?: boolean
  status?: string
  created_at?: string
  village?: string | null
  village_id?: string | null
  asha_id?: string | null
}

interface TimelineEvent {
  type: string
  date: string
  record: Record<string, unknown>
}

function mapBeneficiary(r: RawBeneficiary): Beneficiary {
  return {
    id: r.id,
    abhaId: r.abha_id ?? undefined,
    name: r.full_name,
    dob: r.date_of_birth ?? r.created_at ?? '',
    gender: r.gender === 'male' ? 'male' : r.gender === 'transgender' ? 'transgender' : 'female',
    phone: r.phone ?? undefined,
    village: r.village ?? '',
    phcId: '',
    ashaId: r.asha_id ?? undefined,
    maritalStatus:
      r.marital_status === 'unmarried' ? 'unmarried' : r.marital_status === 'widowed' ? 'widowed' : r.marital_status === 'divorced' ? 'divorced' : r.marital_status ? 'married' : undefined,
    isPregnant: r.is_pregnant ?? false,
    createdAt: r.created_at ?? '',
  }
}

function mapTimelinePregnancy(id: string, r: Record<string, unknown>): Pregnancy {
  const num = (k: string): number => Number(r[k]) || 0
  const level = String(r.risk_level ?? 'low')
  const factors = (r.risk_factors as Record<string, unknown> | null | undefined) ?? {}
  return {
    id: String(r.id ?? ''),
    beneficiaryId: id,
    lmp: String(r.lmp ?? ''),
    edd: String(r.edd ?? ''),
    gravida: num('gravida'),
    para: num('parity'),
    status: r.status === 'delivered' ? 'delivered' : r.status === 'aborted' ? 'aborted' : 'active',
    highRisk: level !== 'low' || Object.keys(factors).length > 0,
    hrpLevel: level === 'high' ? 'high' : level === 'medium' ? 'medium' : undefined,
    complications: Array.isArray(r.complications) ? (r.complications as string[]) : Object.keys(factors),
    registeredAt: String(r.created_at ?? r.registered_at ?? ''),
    registeredBy: r.registered_by ? String(r.registered_by) : undefined,
  }
}

function mapTimelineANC(id: string, r: Record<string, unknown>): ANCVisit {
  return {
    id: String(r.id ?? ''),
    pregnancyId: String(r.pregnancy_id ?? id),
    beneficiaryId: id,
    visitNumber: Number(r.visit_number) || 1,
    date: String(r.visit_date ?? ''),
    gestationWeek: Number(r.gestation_week) || 0,
    weightKg: r.weight_kg != null ? Number(r.weight_kg) : undefined,
    bpSystolic: r.bp_systolic != null ? Number(r.bp_systolic) : undefined,
    bpDiastolic: r.bp_diastolic != null ? Number(r.bp_diastolic) : undefined,
    haemoglobin: r.haemoglobin != null ? Number(r.haemoglobin) : undefined,
    fundalHeight: r.fundal_height != null ? Number(r.fundal_height) : undefined,
    foetalHeartRate: r.foetal_heart_rate != null ? Number(r.foetal_heart_rate) : r.fetal_heart_rate != null ? Number(r.fetal_heart_rate) : undefined,
    hrpFlag: !!r.hrp_flag,
    attendedBy: r.attended_by ? String(r.attended_by) : undefined,
    facility: r.facility_id ? String(r.facility_id) : undefined,
  }
}

function mapTimelineChild(id: string, r: Record<string, unknown>): Child {
  const deliveryType = r.delivery_type === 'c-section' ? 'c-section' : r.delivery_type === 'assisted' ? 'assisted' : 'normal'
  const place = String(r.place_of_birth ?? '')
  return {
    id: String(r.id ?? ''),
    beneficiaryId: id,
    name: String(r.child_name ?? 'Child'),
    dob: String(r.created_at ?? ''),
    gender: r.gender === 'male' ? 'male' : r.gender === 'transgender' ? 'transgender' : 'female',
    birthWeightKg: r.birth_weight_grams != null ? Number(r.birth_weight_grams) / 1000 : undefined,
    gestationalAgeWeeks: r.gestation_weeks != null ? Number(r.gestation_weeks) : undefined,
    deliveryType,
    bornAtFacility: place === 'facility' || place === 'hospital' || place === 'private_hospital',
    ashaId: r.asha_id ? String(r.asha_id) : undefined,
    phcId: '',
  }
}

function mapTimelineImmunization(id: string, r: Record<string, unknown>): Immunization {
  const status = String(r.status ?? 'due')
  return {
    id: String(r.id ?? ''),
    childId: String(r.child_id ?? id),
    vaccineCode: String(r.vaccine_code ?? ''),
    vaccineName: String(r.vaccine_name ?? r.vaccine_code ?? ''),
    doseNumber: Number(r.dose_number) || 1,
    dueDate: String(r.due_date ?? ''),
    administeredDate: r.given_date ? String(r.given_date) : undefined,
    status: status === 'given' ? 'given' : status === 'overdue' ? 'overdue' : status === 'skipped' ? 'skipped' : 'due',
    administeredAt: r.given_date ? String(r.given_date) : undefined,
    facility: r.facility_id ? String(r.facility_id) : undefined,
  }
}

interface RawBeneficiaryPage {
  items: RawBeneficiary[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export const beneficiaryService = {
  async listBeneficiaries(params: BeneficiaryListParams = {}): Promise<Paginated<Beneficiary>> {
    try {
      const { data } = await api.get<RawBeneficiaryPage>('/beneficiaries', {
        params: {
          q: params.search || undefined,
          village: params.village || undefined,
          status: params.status === 'all' ? undefined : params.status,
          has_abha: params.hasAbha,
          page: params.page ?? 1,
          page_size: params.pageSize ?? 10,
        },
      })
      return {
        items: (data.items ?? []).map(mapBeneficiary),
        total: data.total,
        page: data.page,
        pageSize: data.page_size,
        totalPages: data.total_pages,
      }
    } catch (err) {
      console.warn('listBeneficiaries fallback', err)
      const { search, village, status = 'all', hasAbha, page = 1, pageSize = 10 } = params
      let items = FALLBACK_BENEFICIARIES.filter((b) => {
        if (village && b.village !== village) return false
        if (hasAbha && !b.abhaId) return false
        if (status !== 'all') {
          if (status === 'pregnant' && !b.isPregnant) return false
          if (status === 'postnatal' && (!b.hasChild || b.isPregnant)) return false
          if (status === 'child' && !b.hasChild) return false
          if (status === 'eligible' && (b.isPregnant || b.hasChild)) return false
        }
        if (search) {
          const q = search.toLowerCase()
          if (!b.name.toLowerCase().includes(q) && !(b.abhaId ?? '').toLowerCase().includes(q) && !(b.phone ?? '').includes(q)) {
            return false
          }
        }
        return true
      })
      const total = items.length
      items = items.slice((page - 1) * pageSize, page * pageSize)
      return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
    }
  },

  async getBeneficiary(id: string): Promise<BeneficiaryTimeline> {
    try {
      const [{ data: ben }, { data: timeline }] = await Promise.all([
        api.get<RawBeneficiary>(`/beneficiaries/${id}`),
        api.get<{ beneficiary_id: string; events: TimelineEvent[] }>(`/beneficiaries/${id}/timeline`),
      ])
      const events = timeline?.events ?? []
      return {
        beneficiary: mapBeneficiary(ben),
        pregnancies: events.filter((e) => e.type === 'Pregnancy').map((e) => mapTimelinePregnancy(id, e.record)),
        ancVisits: events.filter((e) => e.type === 'ANCVISIT').map((e) => mapTimelineANC(id, e.record)),
        children: events.filter((e) => e.type === 'Child').map((e) => mapTimelineChild(id, e.record)),
        immunizations: events.filter((e) => e.type === 'Immunization').map((e) => mapTimelineImmunization(id, e.record)),
      }
    } catch (err) {
      console.warn('getBeneficiary fallback', err)
      const beneficiary = FALLBACK_BENEFICIARIES.find((b) => b.id === id) ?? FALLBACK_BENEFICIARIES[0]
      return {
        beneficiary,
        pregnancies: [
          {
            id: `preg-${id}`,
            beneficiaryId: id,
            lmp: dateOffset(180),
            edd: dateOffset(-90),
            gravida: 2,
            para: 1,
            status: 'active',
            highRisk: id.length % 2 === 0,
            hrpLevel: id.length % 2 === 0 ? 'high' : undefined,
            complications: id.length % 2 === 0 ? ['Anaemia'] : [],
            registeredAt: dateOffset(170),
          },
        ],
        ancVisits: [
          { id: 'anc-1', pregnancyId: 'preg-1', beneficiaryId: id, visitNumber: 1, date: dateOffset(140), gestationWeek: 12, weightKg: 54, bpSystolic: 118, bpDiastolic: 76, haemoglobin: 11.2, hrpFlag: false },
          { id: 'anc-2', pregnancyId: 'preg-1', beneficiaryId: id, visitNumber: 2, date: dateOffset(100), gestationWeek: 18, weightKg: 55, bpSystolic: 124, bpDiastolic: 80, haemoglobin: 10.6, hrpFlag: false },
        ],
        children: [
          { id: 'child-1', beneficiaryId: id, name: 'Child A', dob: dateOffset(700), gender: 'female', birthWeightKg: 2.9, gestationalAgeWeeks: 38, deliveryType: 'normal', bornAtFacility: true, phcId: 'phc-demo' },
        ],
        immunizations: [
          { id: 'imm-1', childId: 'child-1', vaccineCode: 'OPV-1', vaccineName: 'OPV Dose 1', doseNumber: 1, dueDate: dateOffset(620), administeredDate: dateOffset(615), status: 'given' },
          { id: 'imm-2', childId: 'child-1', vaccineCode: 'PENTA-1', vaccineName: 'Pentavalent Dose 1', doseNumber: 1, dueDate: dateOffset(620), administeredDate: dateOffset(615), status: 'given' },
        ],
      }
    }
  },

  async createBeneficiary(payload: Partial<Beneficiary>): Promise<Beneficiary> {
    try {
      const { data } = await api.post<RawBeneficiary>('/beneficiaries', {
        beneficiary_id: payload.id ?? `BEN-${Date.now()}`,
        full_name: payload.name ?? '',
        date_of_birth: payload.dob,
        gender: payload.gender,
        phone: payload.phone,
        marital_status: payload.maritalStatus,
        is_pregnant: payload.isPregnant ?? false,
      })
      return mapBeneficiary(data)
    } catch (err) {
      console.warn('createBeneficiary fallback', err)
      const now = new Date().toISOString()
      return {
        id: `ben-${Date.now()}`,
        name: payload.name ?? 'New Beneficiary',
        dob: payload.dob ?? now,
        gender: payload.gender ?? 'female',
        village: payload.village ?? '',
        phcId: payload.phcId ?? 'phc-demo',
        createdAt: now,
        updatedAt: now,
        ...payload,
      }
    }
  },

  async updateBeneficiary(id: string, payload: Partial<Beneficiary>): Promise<Beneficiary> {
    try {
      const { data } = await api.put<RawBeneficiary>(`/beneficiaries/${id}`, {
        full_name: payload.name,
        date_of_birth: payload.dob,
        gender: payload.gender,
        phone: payload.phone,
        marital_status: payload.maritalStatus,
        is_pregnant: payload.isPregnant,
      })
      return mapBeneficiary(data)
    } catch (err) {
      console.warn('updateBeneficiary fallback', err)
      const base = FALLBACK_BENEFICIARIES.find((b) => b.id === id) ?? FALLBACK_BENEFICIARIES[0]
      return { ...base, ...payload, id, updatedAt: new Date().toISOString() }
    }
  },

  exportCSV(rows: Beneficiary[], filename = 'beneficiaries.csv'): void {
    const header = ['ID', 'Name', 'ABHA', 'DOB', 'Gender', 'Phone', 'Village', 'Pregnant', 'Has Child', 'Created At']
    const lines = rows.map((b) =>
      [b.id, b.name, b.abhaId ?? '', b.dob.slice(0, 10), b.gender, b.phone ?? '', b.village, b.isPregnant ? 'yes' : 'no', b.hasChild ? 'yes' : 'no', b.createdAt.slice(0, 10)].map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','),
    )
    downloadCsv([header.join(','), ...lines].join('\n'), filename)
  },
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
