import type { ASHATask, UpdateASHATaskPayload } from '@/services/asha.service'

export const DAILY_TASK_QUOTA = 5

export interface ViewTask {
  id: string
  title: string
  subtitle: string
  done: boolean
  due: string
  priority: string
  status: string
  householdId?: string
  householdHhid?: string
  householdLabel: string
  carriedFrom?: string
  /** Extra reasons folded into this stop by the plan (one visit closes all). */
  alsoCovers: string[]
}

const TASK_TITLE: Record<string, string> = {
  anc_visit: 'ANC visit',
  pnc_visit: 'PNC visit',
  ec_followup: 'EC follow-up',
  ncd_followup: 'NCD follow-up',
  immunization: 'Immunization',
  child_checkup: 'Child check-up',
  referral_followup: 'Referral follow-up',
  household_visit: 'Household visit',
}

function scheduledLabel(scheduledTime?: string): string {
  if (!scheduledTime) return ''
  const parsed = new Date(scheduledTime)
  if (Number.isNaN(parsed.getTime())) return ''
  return `Scheduled ${parsed.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
}

export function todayISO(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function formatDay(iso?: string): string {
  if (!iso) return ''
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function toViewTask(task: ASHATask): ViewTask {
  const householdLabel = [task.householdHhid, task.villageName].filter(Boolean).join(' · ')
  const rawCarriedFrom = task.metadataJson?.carried_from
  const ownTitle = TASK_TITLE[task.taskType] ?? task.taskType.replace(/_/g, ' ')
  const alsoCovers = mergedReasonLabels(task).filter((label) => label !== ownTitle)
  return {
    id: task.id,
    title: ownTitle,
    subtitle: task.notes || scheduledLabel(task.scheduledTime),
    done: task.status === 'completed' || task.status === 'done',
    due: task.taskDate ?? '',
    priority: task.priority,
    status: task.status,
    householdId: task.householdId,
    householdHhid: task.householdHhid,
    householdLabel,
    carriedFrom: typeof rawCarriedFrom === 'string' ? rawCarriedFrom : undefined,
    alsoCovers,
  }
}

/** Titles of every reason the plan merged into this stop, deduplicated. */
function mergedReasonLabels(task: ASHATask): string[] {
  const raw = task.metadataJson?.reasons
  if (!Array.isArray(raw)) return []
  const labels = new Set<string>()
  for (const reason of raw) {
    if (typeof reason !== 'object' || reason === null) continue
    const type = (reason as { task_type?: unknown }).task_type
    if (typeof type !== 'string' || !type) continue
    labels.add(TASK_TITLE[type] ?? type.replace(/_/g, ' '))
  }
  return [...labels]
}

export function toggleTaskPayload(task: ASHATask): UpdateASHATaskPayload {
  return task.status === 'completed'
    ? { status: 'pending' }
    : { status: 'completed', completedTime: new Date().toISOString() }
}

export function toggleViewTaskPayload(task: ViewTask): UpdateASHATaskPayload {
  return task.done
    ? { status: 'pending' }
    : { status: 'completed', completedTime: new Date().toISOString() }
}
