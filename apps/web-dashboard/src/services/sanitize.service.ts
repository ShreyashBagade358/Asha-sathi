import { api } from '@/lib/api'

export interface SanitizeSummary {
  beneficiariesTotal: number
  beneficiariesPhoneIssues: number
  beneficiariesNameIssues: number
  beneficiariesWithoutHousehold: number
  usersTotal: number
  usersPhoneIssues: number
  usersNameIssues: number
  ashasWithoutProfile: number
}

export type SanitizeAction =
  | 'fix_beneficiary_phones'
  | 'fix_beneficiary_names'
  | 'fix_user_phones'
  | 'fix_user_names'

interface RawSummary {
  beneficiaries_total: number
  beneficiaries_phone_issues: number
  beneficiaries_name_issues: number
  beneficiaries_without_household: number
  users_total: number
  users_phone_issues: number
  users_name_issues: number
  ashas_without_profile: number
}

interface RawFixResponse {
  message: string
  results: Partial<Record<SanitizeAction, number>>
}

export const sanitizeService = {
  async getSummary(): Promise<SanitizeSummary> {
    const { data } = await api.get<RawSummary>('/sanitize/summary')
    return {
      beneficiariesTotal: data.beneficiaries_total,
      beneficiariesPhoneIssues: data.beneficiaries_phone_issues,
      beneficiariesNameIssues: data.beneficiaries_name_issues,
      beneficiariesWithoutHousehold: data.beneficiaries_without_household,
      usersTotal: data.users_total,
      usersPhoneIssues: data.users_phone_issues,
      usersNameIssues: data.users_name_issues,
      ashasWithoutProfile: data.ashas_without_profile,
    }
  },

  async fix(actions: SanitizeAction[]): Promise<RawFixResponse> {
    const { data } = await api.post<RawFixResponse>('/sanitize/fix', { actions })
    return data
  },
}