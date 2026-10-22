import { api } from '@/lib/api'

export interface SyncStatus {
  online: boolean
  lastSyncAt: string | null
  pendingPush: number
  pendingPull: number
  conflicts: number
}

interface RawSyncStatus {
  online: boolean
  last_sync_at: string | null
  pending_push: number
  pending_pull: number
  conflicts: number
}

function mapSyncStatus(r: RawSyncStatus): SyncStatus {
  return {
    online: r.online,
    lastSyncAt: r.last_sync_at,
    pendingPush: r.pending_push ?? 0,
    pendingPull: r.pending_pull ?? 0,
    conflicts: r.conflicts ?? 0,
  }
}

export const syncService = {
  async getStatus(): Promise<SyncStatus> {
    const { data } = await api.get<RawSyncStatus>('/sync/status')
    return mapSyncStatus(data)
  },

  async forcePull(): Promise<{ records: Record<string, unknown[]>; server_time: string; has_more: boolean; next_cursor: string | null }> {
    const { data } = await api.post<{ records: Record<string, unknown[]>; server_time: string; has_more: boolean; next_cursor: string | null }>('/sync/pull', {
      last_pull_at: new Date(0).toISOString(), // Get all changes
      limit: 10000,
    })
    return data
  },

  async resolveAllConflicts(_resolution: 'server_wins' | 'client_wins' = 'server_wins'): Promise<{ message: string }> {
    // This would need a new backend endpoint to resolve all at once
    // For now, we'll call the existing resolve endpoint for each conflict
    // But we need a list of conflicts first
    throw new Error('Not implemented - requires backend endpoint to list conflicts')
  },
}
