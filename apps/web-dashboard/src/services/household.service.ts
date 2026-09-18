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
  addressLocal?: string
  amenities?: Record<string, unknown>
  consentGiven?: boolean
}

interface RawHousehold {
  id: string
  hhid: string
  village_id?: string | null
  asha_id?: string | null
  village?: string | null
  address?: string | null
  amenities?: Record<string, unknown> | null
  consent_given?: boolean
  created_at?: string
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

function mapHousehold(r: RawHousehold): Household {
  return {
    id: r.id,
    householdId: r.hhid,
    village: r.village ?? '',
    headName: '',
    memberCount: 0,
    eligibleWomen: 0,
    childrenUnder5: 0,
    pregnantWomen: 0,
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
      asha_id: payload.ashaId,
      address: payload.address,
      address_local: payload.addressLocal,
      amenities: payload.amenities,
      consent_given: payload.consentGiven,
    })
    return mapHousehold(data)
  },

  async updateHousehold(id: string, patch: Partial<CreateHouseholdPayload>): Promise<Household> {
    const { data } = await api.put<RawHousehold>(`/households/${id}`, patch)
    return mapHousehold(data)
  },

  async deleteHousehold(id: string): Promise<void> {
    await api.delete(`/households/${id}`)
  },
}
