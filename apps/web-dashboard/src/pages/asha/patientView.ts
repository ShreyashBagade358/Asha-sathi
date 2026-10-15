import type { Patient, RiskLevel } from '@/pages/asha/mockData'
import type { Beneficiary } from '@/types'

const RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high']

/** Backend `risk` is a free-text intake annotation — only trust the known levels. */
export function toRiskLevel(risk?: string | null): RiskLevel {
  return RISK_LEVELS.includes(risk as RiskLevel) ? (risk as RiskLevel) : 'low'
}

/** `age_years` is authoritative when stored; DOB is the fallback (and vice versa). */
export function ageFromBeneficiary(b: Beneficiary): number {
  if (typeof b.ageYears === 'number' && b.ageYears > 0) return b.ageYears
  if (!b.dob) return 0
  const birth = new Date(b.dob)
  if (Number.isNaN(birth.getTime())) return 0
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const months = now.getMonth() - birth.getMonth()
  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) age -= 1
  return Math.max(age, 0)
}

export function formatRecordDate(value?: string): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function capitalize(value?: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '—'
}

/** Maps an API beneficiary onto the ASHA pages' patient view-model shape. */
export function beneficiaryToPatient(b: Beneficiary): Patient {
  const risk = toRiskLevel(b.risk)
  return {
    id: b.id,
    beneficiaryId: b.id,
    name: b.name,
    abhaId: b.abhaId ?? '—',
    age: ageFromBeneficiary(b),
    gender: capitalize(b.gender),
    bloodGroup: b.bloodGroup || '—',
    phone: b.phone ? (b.phone.startsWith('+') ? b.phone : `+91 ${b.phone}`) : '—',
    address: b.householdId
      ? `Household ${b.householdId}${b.village ? `, ${b.village}` : ''}`
      : b.village || '—',
    village: b.village || '—',
    ward: '—',
    householdId: b.householdId,
    risk,
    riskReason:
      risk === 'high' || risk === 'medium' ? b.notes || 'Under monitoring' : undefined,
    pregnant: b.isPregnant ? true : undefined,
    registeredAt: formatRecordDate(b.createdAt),
    activeConditions: b.notes ? [b.notes] : [],
  }
}
