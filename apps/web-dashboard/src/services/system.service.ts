import { api } from '@/lib/api'

export interface SystemStatus {
  api: { status: string; version: string; started_at: string; uptime_seconds: number }
  database: { status: string; latency_ms?: number }
  models: { available: number; total: number }
  counts: { users: number; asha_workers: number; beneficiaries: number; pregnancies: number }
}

export const systemService = {
  async getStatus(): Promise<SystemStatus> {
    const { data } = await api.get<SystemStatus>('/system/status')
    return data
  },
}
