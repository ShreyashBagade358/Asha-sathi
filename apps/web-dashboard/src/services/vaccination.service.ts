import { api } from '@/lib/api'

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
    const { data } = await api.get<RawDueItem[]>('/vaccination/due')
    return data.map((d) => ({
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
}
