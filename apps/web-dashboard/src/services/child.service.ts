import { api } from '@/lib/api'
import type { Child, Immunization, Paginated } from '@/types'

export interface ChildListParams {
  page?: number
  pageSize?: number
}

export interface CreateChildPayload {
  beneficiaryId: string
  birthWeightGrams?: number
  birthLengthCm?: number
  headCircumferenceCm?: number
  gestationWeeks?: number
  deliveryType?: 'normal' | 'c-section' | 'assisted'
  placeOfBirth?: string
}

export interface CreateImmunizationPayload {
  vaccineCode: string
  vaccineName?: string
  doseNumber?: number
  givenDate?: string
  dueDate?: string
  status?: 'given' | 'due'
}

interface RawChild {
  id: string
  beneficiary_id: string
  birth_weight_grams?: number | null
  gestation_weeks?: number | null
  delivery_type?: string | null
  place_of_birth?: string | null
  created_at?: string
}

interface RawChildPageItem {
  id: string
  beneficiary_id: string
  birth_registration_no?: string | null
  birth_weight_grams?: number | null
  gestation_weeks?: number | null
  congenital_anomalies?: unknown
}

interface RawImmunization {
  id: string
  child_id: string
  vaccine_code: string
  vaccine_name?: string | null
  dose_number?: number
  due_date?: string | null
  given_date?: string | null
  status?: string
}

function mapChildFromDetail(r: RawChild): Child {
  const place = r.place_of_birth ?? ''
  return {
    id: r.id,
    beneficiaryId: r.beneficiary_id,
    name: 'Child',
    dob: r.created_at ?? '',
    gender: 'female',
    birthWeightKg: r.birth_weight_grams != null ? r.birth_weight_grams / 1000 : undefined,
    gestationalAgeWeeks: r.gestation_weeks ?? undefined,
    deliveryType: r.delivery_type === 'c-section' ? 'c-section' : r.delivery_type === 'assisted' ? 'assisted' : 'normal',
    bornAtFacility: place === 'facility' || place === 'hospital' || place === 'private_hospital',
    phcId: '',
  }
}

function mapImmunization(r: RawImmunization): Immunization {
  const status = r.status ?? 'due'
  return {
    id: r.id,
    childId: r.child_id,
    vaccineCode: r.vaccine_code,
    vaccineName: r.vaccine_name ?? r.vaccine_code,
    doseNumber: r.dose_number ?? 1,
    dueDate: r.due_date ?? '',
    administeredDate: r.given_date ?? undefined,
    status: status === 'given' ? 'given' : status === 'overdue' ? 'overdue' : 'due',
    administeredAt: r.given_date ?? undefined,
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

export const childService = {
  async listChildren(params: ChildListParams = {}): Promise<Paginated<RawChildPageItem>> {
    const { data } = await api.get<{ items: RawChildPageItem[]; total: number; page: number; page_size: number; total_pages: number }>('/children', {
      params: { page: params.page ?? 1, page_size: params.pageSize ?? 10 },
    })
    return mapPaginated(data)
  },

  async getChild(id: string): Promise<Child> {
    const { data } = await api.get<RawChild>(`/children/${id}`)
    return mapChildFromDetail(data)
  },

  async createChild(payload: CreateChildPayload): Promise<RawChildPageItem> {
    const { data } = await api.post<RawChildPageItem>('/children', {
      beneficiary_id: payload.beneficiaryId,
      birth_weight_grams: payload.birthWeightGrams,
      birth_length_cm: payload.birthLengthCm,
      head_circumference_cm: payload.headCircumferenceCm,
      gestation_weeks: payload.gestationWeeks,
      delivery_type: payload.deliveryType,
      place_of_birth: payload.placeOfBirth,
    })
    return data
  },

  async listImmunizations(childId: string): Promise<Immunization[]> {
    const { data } = await api.get<RawImmunization[]>(`/children/${childId}/immunizations`)
    return data.map(mapImmunization)
  },

  async createImmunization(childId: string, payload: CreateImmunizationPayload): Promise<Immunization> {
    const { data } = await api.post<RawImmunization>(`/children/${childId}/immunizations`, {
      child_id: childId,
      vaccine_code: payload.vaccineCode,
      vaccine_name: payload.vaccineName,
      dose_number: payload.doseNumber,
      given_date: payload.givenDate,
      due_date: payload.dueDate,
      status: payload.status,
    })
    return mapImmunization(data)
  },

  async deleteChild(id: string): Promise<void> {
    await api.delete(`/children/${id}`)
  },
}
