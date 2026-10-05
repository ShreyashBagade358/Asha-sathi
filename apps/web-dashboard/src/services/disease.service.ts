import { api } from '@/lib/api'
import type { Paginated } from '@/types'

/** A single tracked disease case. `null` means "not recorded", never a guess. */
export interface DiseaseCase {
  id: string
  diseaseType: string
  beneficiaryId?: string
  villageId?: string
  detectionDate?: string
  diagnosisDate?: string
  labConfirmed: boolean
  treatmentStarted: boolean
  treatmentOutcome?: string
  status: string
}

export interface DiseaseCaseListParams {
  diseaseType?: string
  status?: string
  beneficiaryId?: string
  page?: number
  pageSize?: number
}

interface RawDiseaseCase {
  id: string
  disease_type: string
  beneficiary_id?: string | null
  village_id?: string | null
  detection_date?: string | null
  diagnosis_date?: string | null
  lab_confirmed?: boolean | null
  treatment_started?: boolean | null
  treatment_outcome?: string | null
  status?: string | null
}

function mapDiseaseCase(r: RawDiseaseCase): DiseaseCase {
  return {
    id: r.id,
    diseaseType: r.disease_type,
    beneficiaryId: r.beneficiary_id ?? undefined,
    villageId: r.village_id ?? undefined,
    detectionDate: r.detection_date ?? undefined,
    diagnosisDate: r.diagnosis_date ?? undefined,
    labConfirmed: r.lab_confirmed ?? false,
    treatmentStarted: r.treatment_started ?? false,
    treatmentOutcome: r.treatment_outcome ?? undefined,
    status: r.status ?? '',
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

export const diseaseService = {
  async listDiseaseCases(params: DiseaseCaseListParams = {}): Promise<Paginated<DiseaseCase>> {
    const { data } = await api.get<{ items: RawDiseaseCase[]; total: number; page: number; page_size: number; total_pages: number }>('/diseases', {
      params: {
        disease_type: params.diseaseType,
        status: params.status,
        beneficiary_id: params.beneficiaryId,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 10,
      },
    })
    return mapPaginated({ ...data, items: data.items.map(mapDiseaseCase) })
  },
}
