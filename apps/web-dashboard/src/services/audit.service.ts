import { api } from '@/lib/api'
import type { AuditLogEntry, Paginated } from '@/types'

export interface AuditLogListParams {
  page?: number
  pageSize?: number
  userId?: string
  action?: string
  entityType?: string
  entityId?: string
  status?: string
  q?: string
}

export interface AuditLogSummary {
  total: number
  success: number
  denied: number
  error: number
}

const ACTION_MAP: Record<string, AuditLogEntry['action']> = {
  login: 'login',
  logout: 'logout',
  create: 'create',
  update: 'update',
  delete: 'delete',
  export: 'export',
  config_change: 'config_change',
  policy_change: 'policy_change',
  user_management: 'user_management',
}

const ACTION_ALIASES: Record<string, AuditLogEntry['action']> = {
  otp_sent: 'login',
  otp_verified: 'login',
  password_login: 'login',
  asha_created: 'create',
  beneficiary_created: 'create',
  household_created: 'create',
  pregnancy_created: 'create',
  referral_created: 'create',
}

function normalizeAction(action: string): AuditLogEntry['action'] {
  return ACTION_MAP[action] ?? ACTION_ALIASES[action] ?? 'create'
}

interface RawLog {
  id: string
  user_id: string
  actor_name?: string
  action: string
  entity_type?: string
  entity_id?: string
  old_values?: unknown
  new_values?: unknown
  changed_fields?: string[]
  ip_address?: string | null
  status?: string
  error_message?: string | null
  created_at?: string
}

function describe(log: RawLog): string {
  const resource = log.entity_type ?? ''
  const changed = Array.isArray(log.changed_fields) ? log.changed_fields.join(', ') : ''
  if (changed) return `${resource} updated — ${changed}`
  if (log.error_message) return log.error_message
  if (log.entity_id) return `${resource} · ${log.entity_id}`
  return resource
}

function mapLog(r: RawLog): AuditLogEntry {
  return {
    id: r.id,
    timestamp: r.created_at ?? '',
    actorId: r.user_id,
    actorName: r.actor_name ?? '',
    actorRole: 'admin',
    action: normalizeAction(r.action),
    resource: r.entity_type ?? '',
    resourceId: r.entity_id ?? undefined,
    details: describe(r),
    ip: r.ip_address ?? undefined,
    status: r.status === 'denied' ? 'denied' : r.status === 'error' ? 'error' : 'success',
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

export const auditService = {
  async listLogs(params: AuditLogListParams = {}): Promise<Paginated<AuditLogEntry>> {
    const { data } = await api.get<{ items: RawLog[]; total: number; page: number; page_size: number; total_pages: number }>('/audit/logs', {
      params: {
        user_id: params.userId,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        status: params.status,
        q: params.q,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 20,
      },
    })
    return mapPaginated({ ...data, items: data.items.map(mapLog) })
  },

  async getSummary(): Promise<AuditLogSummary> {
    const { data } = await api.get<AuditLogSummary>('/audit/summary')
    return data
  },
}
