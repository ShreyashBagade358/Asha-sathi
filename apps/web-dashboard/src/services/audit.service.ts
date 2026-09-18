import { api } from '@/lib/api'
import type { AuditLogEntry, Paginated } from '@/types'

export interface AuditLogListParams {
  page?: number
  pageSize?: number
  userId?: string
  action?: string
  entityType?: string
  entityId?: string
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
  action: string
  entity_type?: string
  entity_id?: string
  old_values?: unknown
  new_values?: unknown
  ip_address?: string | null
  status?: string
  created_at?: string
}

function mapLog(r: RawLog): AuditLogEntry {
  return {
    id: r.id,
    timestamp: r.created_at ?? '',
    actorId: r.user_id,
    actorName: '',
    actorRole: 'moic',
    action: normalizeAction(r.action),
    resource: r.entity_type ?? '',
    resourceId: r.entity_id ?? undefined,
    details: '',
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
        page: params.page ?? 1,
        page_size: params.pageSize ?? 20,
      },
    })
    return mapPaginated({ ...data, items: data.items.map(mapLog) })
  },
}
