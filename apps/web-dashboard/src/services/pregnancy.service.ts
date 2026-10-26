import { api } from '@/lib/api'
import type { ANCVisit, Paginated, Pregnancy } from '@/types'

export interface PregnancyListParams {
  status?: 'ongoing' | 'delivered' | 'aborted' | 'ltf' | 'all'
  beneficiaryId?: string
  page?: number
  pageSize?: number
}

export interface CreatePregnancyPayload {
  beneficiaryId: string
  lmp?: string
  edd?: string
  gravida?: number
  parity?: number
  riskLevel?: 'low' | 'medium' | 'high'
  riskFactors?: Record<string, unknown>
}

export interface CreateANCVisitPayload {
  visitNumber?: number
  visitDate: string
  bpSystolic?: number
  bpDiastolic?: number
  weightKg?: number
  heightCm?: number
  hemoglobin?: number
  fundalHeightCm?: number
  fetalHeartRate?: number
  dangerSigns?: string[]
}

export interface CreatePNCVisitPayload {
  visitNumber?: number
  visitDate: string
  bpSystolic?: number
  bpDiastolic?: number
  weightKg?: number
  bleedingStatus?: string
  breastfeedingStatus?: string
  dangerSignsMother?: Record<string, unknown>
  referralMade?: boolean
  referralReason?: string
}

export interface RecordDeliveryPayload {
  deliveryDate?: string
  placeOfDelivery?: string
  deliveryType?: string
  outcome?: string
  birthWeightGrams?: number
  complications?: Record<string, unknown>
  maternalCondition?: string
  newbornCondition?: string
}

export interface BirthPlanPayload {
  preferredFacilityId?: string
  transportArranged?: boolean
  transportDetails?: string
  bloodDonorArranged?: boolean
  companionName?: string
  companionPhone?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  fundsArranged?: boolean
  fundsSource?: string
}

export interface PNCVisit {
  id: string
  pregnancy_id: string
  visit_number: number
  visit_date: string
  bp_systolic?: number | null
  bp_diastolic?: number | null
  bleeding_status?: string | null
  breastfeeding_status?: string | null
  referral_made: boolean
  created_at?: string
}

export interface DeliveryOutcome {
  id: string
  pregnancy_id: string
  delivery_date?: string | null
  place_of_delivery?: string | null
  delivery_type?: string | null
  outcome?: string | null
  birth_weight_grams?: number | null
  complications?: Record<string, unknown> | null
}

export interface BirthPlan {
  id: string
  pregnancy_id: string
  preferred_delivery_facility_id?: string | null
  transport_arranged: boolean
  blood_donor_arranged: boolean
  companion_name?: string | null
  funds_arranged: boolean
}

interface RawPregnancy {
  id: string
  beneficiary_id: string
  lmp?: string | null
  edd?: string | null
  gravida?: number | null
  parity?: number | null
  risk_level?: string | null
  risk_factors?: Record<string, unknown> | null
  last_anc_date?: string | null
  next_anc_due?: string | null
  anc_count?: number
  status?: string
  created_at?: string
}

interface RawANC {
  id: string
  pregnancy_id: string
  visit_number?: number
  visit_date?: string
  gestation_week?: number
  bp_systolic?: number | null
  bp_diastolic?: number | null
  weight_kg?: number | null
  hemoglobin?: number | null
  fundal_height_cm?: number | null
  fetal_heart_rate?: number | null
  hrp_flag?: boolean
}

export function mapPregnancy(r: RawPregnancy): Pregnancy {
  const risk = r.risk_level ?? 'low'
  return {
    id: r.id,
    beneficiaryId: r.beneficiary_id,
    lmp: r.lmp ?? '',
    edd: r.edd ?? '',
    gravida: r.gravida ?? 0,
    para: r.parity ?? 0,
    status: r.status === 'delivered' ? 'delivered' : r.status === 'aborted' ? 'aborted' : r.status === 'ltf' ? 'ltf' : 'ongoing',
    highRisk: risk !== 'low' || Object.keys(r.risk_factors ?? {}).length > 0,
    hrpLevel: risk === 'high' ? 'high' : risk === 'medium' ? 'medium' : undefined,
    complications: Array.isArray(r.risk_factors)
      ? r.risk_factors
      : Object.entries(r.risk_factors ?? {}).map(([k, v]) => (v === true || v == null ? k : `${k} (${v})`)),
    ancCount: r.anc_count ?? 0,
    lastAncDate: r.last_anc_date ?? '',
    nextAncDue: r.next_anc_due ?? '',
    registeredAt: r.created_at ?? '',
  }
}

function mapANC(r: RawANC, beneficiaryId: string): ANCVisit {
  return {
    id: r.id,
    pregnancyId: r.pregnancy_id,
    beneficiaryId,
    visitNumber: r.visit_number ?? 1,
    date: r.visit_date ?? '',
    gestationWeek: r.gestation_week ?? 0,
    weightKg: r.weight_kg ?? undefined,
    bpSystolic: r.bp_systolic ?? undefined,
    bpDiastolic: r.bp_diastolic ?? undefined,
    haemoglobin: r.hemoglobin ?? undefined,
    fundalHeight: r.fundal_height_cm ?? undefined,
    foetalHeartRate: r.fetal_heart_rate ?? undefined,
    hrpFlag: r.hrp_flag ?? false,
  }
}

function mapPaginated<T>(raw: { items: T[]; total: number; page: number; page_size: number; total_pages: number }): Paginated<T> {
  return {
    items: raw.items,
    total: raw.total,
    page: raw.page,
    pageSize: raw.page_size,
    totalPages: raw.total_pages,
  }
}

export const pregnancyService = {
  async listPregnancies(params: PregnancyListParams = {}): Promise<Paginated<Pregnancy>> {
    const { data } = await api.get<{ items: RawPregnancy[]; total: number; page: number; page_size: number; total_pages: number }>('/pregnancies', {
      params: {
        status: params.status,
        beneficiary_id: params.beneficiaryId,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 10,
      },
    })
    return mapPaginated({ ...data, items: data.items.map(mapPregnancy) })
  },

  async getPregnancy(id: string): Promise<Pregnancy> {
    const { data } = await api.get<RawPregnancy>(`/pregnancies/${id}`)
    return mapPregnancy(data)
  },

  async createPregnancy(payload: CreatePregnancyPayload): Promise<Pregnancy> {
    const { data } = await api.post<RawPregnancy>('/pregnancies', {
      beneficiary_id: payload.beneficiaryId,
      lmp: payload.lmp || undefined,
      edd: payload.edd || undefined,
      gravida: payload.gravida,
      parity: payload.parity,
      risk_level: payload.riskLevel,
      risk_factors: payload.riskFactors,
    })
    return mapPregnancy(data)
  },


  async addANCVisit(pregnancyId: string, payload: CreateANCVisitPayload): Promise<ANCVisit> {
    const { data } = await api.post<RawANC>(`/pregnancies/${pregnancyId}/anc`, {
      visit_number: payload.visitNumber,
      visit_date: payload.visitDate,
      bp_systolic: payload.bpSystolic,
      bp_diastolic: payload.bpDiastolic,
      weight_kg: payload.weightKg,
      height_cm: payload.heightCm,
      hemoglobin: payload.hemoglobin,
      fundal_height_cm: payload.fundalHeightCm,
      fetal_heart_rate: payload.fetalHeartRate,
      danger_signs: payload.dangerSigns,
    })
    return mapANC(data, '')
  },

  async listANCVisits(pregnancyId: string, beneficiaryId = ''): Promise<ANCVisit[]> {
    const { data } = await api.get<RawANC[]>(`/pregnancies/${pregnancyId}/anc`)
    return data.map((v) => mapANC(v, beneficiaryId))
  },

  async deletePregnancy(id: string): Promise<void> {
    await api.delete(`/pregnancies/${id}`)
  },

  async updatePregnancy(id: string, payload: Partial<CreatePregnancyPayload> & { status?: string }): Promise<Pregnancy> {
    const { data } = await api.put<RawPregnancy>(`/pregnancies/${id}`, {
      lmp: payload.lmp || undefined,
      edd: payload.edd || undefined,
      gravida: payload.gravida,
      parity: payload.parity,
      risk_level: payload.riskLevel,
      risk_factors: payload.riskFactors,
      status: payload.status,
    })
    return mapPregnancy(data)
  },

  async addPNCVisit(pregnancyId: string, payload: CreatePNCVisitPayload): Promise<PNCVisit> {
    const { data } = await api.post<PNCVisit>(`/pregnancies/${pregnancyId}/pnc`, {
      visit_number: payload.visitNumber,
      visit_date: payload.visitDate,
      bp_systolic: payload.bpSystolic,
      bp_diastolic: payload.bpDiastolic,
      weight_kg: payload.weightKg,
      bleeding_status: payload.bleedingStatus,
      breastfeeding_status: payload.breastfeedingStatus,
      danger_signs_mother: payload.dangerSignsMother,
      referral_made: payload.referralMade,
      referral_reason: payload.referralReason,
    })
    return data
  },

  async listPNCVisits(pregnancyId: string): Promise<PNCVisit[]> {
    const { data } = await api.get<PNCVisit[]>(`/pregnancies/${pregnancyId}/pnc`)
    return data
  },

  async recordDelivery(pregnancyId: string, payload: RecordDeliveryPayload): Promise<DeliveryOutcome> {
    const { data } = await api.post<DeliveryOutcome>(`/pregnancies/${pregnancyId}/delivery`, {
      delivery_date: payload.deliveryDate,
      place_of_delivery: payload.placeOfDelivery,
      delivery_type: payload.deliveryType,
      outcome: payload.outcome,
      birth_weight_grams: payload.birthWeightGrams,
      complications: payload.complications,
      maternal_condition: payload.maternalCondition,
      newborn_condition: payload.newbornCondition,
    })
    return data
  },

  async getDeliveryOutcome(pregnancyId: string): Promise<DeliveryOutcome | null> {
    try {
      const { data } = await api.get<DeliveryOutcome>(`/pregnancies/${pregnancyId}/delivery`)
      return data
    } catch {
      return null
    }
  },

  async saveBirthPlan(pregnancyId: string, payload: BirthPlanPayload): Promise<BirthPlan> {
    const body = {
      preferred_delivery_facility_id: payload.preferredFacilityId || undefined,
      transport_arranged: payload.transportArranged,
      transport_details: payload.transportDetails,
      blood_donor_arranged: payload.bloodDonorArranged,
      companion_name: payload.companionName,
      companion_phone: payload.companionPhone,
      emergency_contact_name: payload.emergencyContactName,
      emergency_contact_phone: payload.emergencyContactPhone,
      funds_arranged: payload.fundsArranged,
      funds_source: payload.fundsSource,
    }
    const { data } = await api.put<BirthPlan>(`/pregnancies/${pregnancyId}/birth-plan`, body)
    return data
  },
}
