import { api } from '@/lib/api'
import type { Household, Paginated } from '@/types'

export interface HouseholdListParams {
  search?: string
  villageId?: string
  ashaId?: string
  page?: number
  pageSize?: number
}

export interface HouseholdMember {
  id: string
  beneficiaryId: string
  householdId: string
  fullName: string
  gender?: string
  ageYears?: number
  ageMonths?: number
  phone?: string
  maritalStatus?: string
  bloodGroup?: string
  isPregnant?: boolean
  isLactating?: boolean
  status?: string
  village?: string
}

export interface CreateHouseholdPayload {
  hhid: string
  villageId?: string
  ashaId?: string
  address?: string
  addressLocal?: Record<string, string>
  amenities?: Record<string, unknown>
  headName?: string
  ward?: string
  familySize?: number
  contactPhone?: string
  notes?: string
  consentGiven?: boolean
}

export interface HouseholdSurveyPayload {
  answers: Record<string, unknown>
  consentObtained?: boolean
  visitedAt?: string
}

export interface HouseholdSurvey {
  id: string
  householdId: string
  answers: Record<string, unknown>
  consentObtained: boolean
  visitedAt?: string
  createdAt: string
}

interface RawHousehold {
  id: string
  hhid: string
  village_id?: string | null
  asha_id?: string | null
  village?: string | null
  address?: string | null
  head_name?: string | null
  ward?: string | null
  family_size?: number | null
  contact_phone?: string | null
  notes?: string | null
  amenities?: Record<string, unknown> | null
  consent_given?: boolean
  created_at?: string
  member_count?: number | null
  eligible_women?: number | null
  children_under5?: number | null
  pregnant_women?: number | null
}

interface RawMember {
  id: string
  beneficiary_id: string
  household_id: string
  full_name: string
  gender?: string | null
  age_years?: number | null
  age_months?: number | null
  phone?: string | null
  marital_status?: string | null
  blood_group?: string | null
  is_pregnant?: boolean
  is_lactating?: boolean
  status?: string
  village?: string | null
}

interface RawSurvey {
  id: string
  household_id: string
  answers: Record<string, unknown>
  consent_obtained?: boolean
  visited_at?: string | null
  created_at?: string
}

function mapSurvey(r: RawSurvey): HouseholdSurvey {
  return {
    id: r.id,
    householdId: r.household_id,
    answers: r.answers ?? {},
    consentObtained: r.consent_obtained ?? false,
    visitedAt: r.visited_at ?? undefined,
    createdAt: r.created_at ?? '',
  }
}

function mapHousehold(r: RawHousehold): Household {
  return {
    id: r.id,
    householdId: r.hhid,
    village: r.village ?? '',
    ward: r.ward ?? undefined,
    headName: r.head_name ?? '',
    memberCount: r.member_count ?? 0,
    eligibleWomen: r.eligible_women ?? 0,
    childrenUnder5: r.children_under5 ?? 0,
    pregnantWomen: r.pregnant_women ?? 0,
    address: r.address ?? undefined,
    familySize: r.family_size ?? undefined,
    contactPhone: r.contact_phone ?? undefined,
    notes: r.notes ?? undefined,
  }
}

function mapMember(r: RawMember): HouseholdMember {
  return {
    id: r.id,
    beneficiaryId: r.beneficiary_id,
    householdId: r.household_id,
    fullName: r.full_name,
    gender: r.gender ?? undefined,
    ageYears: r.age_years ?? undefined,
    ageMonths: r.age_months ?? undefined,
    phone: r.phone ?? undefined,
    maritalStatus: r.marital_status ?? undefined,
    bloodGroup: r.blood_group ?? undefined,
    isPregnant: r.is_pregnant ?? false,
    isLactating: r.is_lactating ?? false,
    status: r.status ?? undefined,
    village: r.village ?? undefined,
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

export const householdService = {
  async listHouseholds(params: HouseholdListParams = {}): Promise<Paginated<Household>> {
    const { data } = await api.get<{ items: RawHousehold[]; total: number; page: number; page_size: number; total_pages: number }>('/households', {
      params: {
        q: params.search || undefined,
        village_id: params.villageId || undefined,
        asha_id: params.ashaId || undefined,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 10,
      },
    })
    return mapPaginated({ ...data, items: data.items.map(mapHousehold) })
  },

  async getHousehold(id: string): Promise<Household> {
    const { data } = await api.get<RawHousehold>(`/households/${id}`)
    return mapHousehold(data)
  },

  async listHouseholdMembers(householdId: string, params: { page?: number; pageSize?: number } = {}): Promise<Paginated<HouseholdMember>> {
    const { data } = await api.get<{ items: RawMember[]; total: number; page: number; page_size: number; total_pages: number }>(`/households/${householdId}/members`, {
      params: { page: params.page ?? 1, page_size: params.pageSize ?? 50 },
    })
    return mapPaginated({ ...data, items: data.items.map(mapMember) })
  },

  async createHousehold(payload: CreateHouseholdPayload): Promise<Household> {
    const { data } = await api.post<RawHousehold>('/households', {
      hhid: payload.hhid,
      village_id: payload.villageId,
      address: payload.address,
      address_local: payload.addressLocal,
      amenities: payload.amenities,
      head_name: payload.headName,
      ward: payload.ward,
      family_size: payload.familySize,
      contact_phone: payload.contactPhone,
      notes: payload.notes,
      consent_given: payload.consentGiven,
    })
    return mapHousehold(data)
  },

  async submitSurvey(householdId: string, payload: HouseholdSurveyPayload): Promise<HouseholdSurvey> {
    const { data } = await api.post<RawSurvey>(`/households/${householdId}/survey`, {
      answers: payload.answers,
      consent_obtained: payload.consentObtained,
      visited_at: payload.visitedAt,
    })
    return mapSurvey(data)
  },

  async listSurveys(householdId: string): Promise<HouseholdSurvey[]> {
    const { data } = await api.get<RawSurvey[]>(`/households/${householdId}/surveys`)
    return data.map(mapSurvey)
  },

  async deleteHousehold(id: string): Promise<void> {
    await api.delete(`/households/${id}`)
  },
}
