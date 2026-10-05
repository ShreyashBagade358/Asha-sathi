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
}
