import { api } from '@/lib/api'
import { isAxiosError } from 'axios'

export interface VaccinationScheduleEntry {
  vaccine_code: string
  vaccine_name: string
  dose: number
  age: string
  age_months: number
  route: string
  site: string
}

export interface VaccinationSchedule {
  schedule: VaccinationScheduleEntry[]
  source: string
  updated_at: string
}

export interface ChildVaccinationStatusDose {
  vaccine_code: string
  vaccine_name: string
  dose_number: number
  due_date: string | null
  given_date: string | null
  status: string
  effective_status: string
}

export interface ChildVaccinationStatus {
  total: number
  given: number
  due: number
  overdue: number
  progress_pct: number
  fully_immunized: boolean
  overall_status: string
  next_due: { vaccine_code: string; vaccine_name: string; dose_number: number; due_date: string } | null
  by_dose: ChildVaccinationStatusDose[]
}

export interface VaccinationDose {
  id: string
  childId: string
  childName?: string
  vaccineCode: string
  vaccineName: string
  doseNumber: number
  dueDate: string
  status: string
  beneficiaryName?: string
}

export interface VaccinationCoverage {
  totalChildren: number
  totalImmunizations: number
  given: number
  due: number
  coveragePct: number
  byVaccine: Array<{ vaccineCode: string; given: number; due?: number }>
}

interface RawDueItem {
  child_id?: string
  child_name?: string
  beneficiary_name?: string
  vaccine_code: string
  vaccine_name?: string
  dose_number?: number
  due_date?: string
  status?: string
}

export const vaccinationService = {
  async getCoverage(): Promise<VaccinationCoverage> {
    const { data } = await api.get<{
      total_children: number
      total_immunizations: number
      given: number
      due: number
      coverage_pct: number
      by_vaccine: Array<{ vaccine_code: string; given: number }>
    }>('/vaccination/coverage')
    return {
      totalChildren: data.total_children,
      totalImmunizations: data.total_immunizations,
      given: data.given,
      due: data.due,
      coveragePct: data.coverage_pct,
      byVaccine: data.by_vaccine.map((v) => ({ vaccineCode: v.vaccine_code, given: v.given })),
    }
  },

  async getDueVaccinations(): Promise<VaccinationDose[]> {
    // The endpoint returns an envelope, not a bare array.
    const { data } = await api.get<{ count: number; due: RawDueItem[] }>('/vaccination/due')
    return (data.due ?? []).map((d) => ({
      id: `${d.child_id}-${d.vaccine_code}`,
      childId: d.child_id ?? '',
      childName: d.child_name,
      beneficiaryName: d.beneficiary_name,
      vaccineCode: d.vaccine_code,
      vaccineName: d.vaccine_name ?? d.vaccine_code,
      doseNumber: d.dose_number ?? 1,
      dueDate: d.due_date ?? '',
      status: d.status ?? 'due',
    }))
  },

  async getSchedule(): Promise<VaccinationSchedule> {
    const { data } = await api.get<{
      schedule: VaccinationScheduleEntry[]
      source: string
      updated_at: string
    }>('/vaccination/schedule')
    return {
      schedule: data.schedule ?? [],
      source: data.source ?? '',
      updated_at: data.updated_at ?? '',
    }
  },

  async getChildVaccinationStatus(childId: string): Promise<ChildVaccinationStatus | null> {
    try {
      const { data } = await api.get<ChildVaccinationStatus>(`/vaccination/children/${childId}/vaccination-status`)
      return data
    } catch (err) {
      // Endpoint may not be deployed yet (404) — callers should fall back to listImmunizations.
      if (isAxiosError(err) && err.response?.status === 404) return null
      throw err
    }
  },
}
