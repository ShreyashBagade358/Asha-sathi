import { api } from '@/lib/api'
import type { Role, User } from '@/types'

export interface UpdateMePayload {
  fullName?: string
  email?: string
  avatarUrl?: string
  language?: string
  employeeId?: string
}

export interface ProfileUser {
  id: string
  role: string
  phone: string
  email?: string
  fullName: string
  language?: string
}

interface RawUser {
  id: string
  role: string
  phone: string
  email?: string | null
  full_name: string
  language?: string | null
  is_active?: boolean
  created_at?: string
  last_login_at?: string | null
  state_id?: string | null
  district_id?: string | null
  block_id?: string | null
  phc_id?: string | null
  state_name?: string | null
  district_name?: string | null
  phc_name?: string | null
}

export const profileService = {
  /**
   * `GET /auth/me` mapped to the app's `User`. The login response is only a
   * summary (no geo scope), so this is where `phcId`/`districtId` come from —
   * every `user?.phcId` consumer depends on it.
   */
  async getMe(): Promise<User> {
    const { data } = await api.get<RawUser>('/auth/me')
    return {
      id: data.id,
      role: data.role as Role,
      fullName: data.full_name,
      phone: data.phone,
      email: data.email ?? undefined,
      language: data.language ?? undefined,
      stateId: data.state_id ?? '',
      stateName: data.state_name ?? undefined,
      districtId: data.district_id ?? undefined,
      districtName: data.district_name ?? undefined,
      blockId: data.block_id ?? undefined,
      phcId: data.phc_id ?? undefined,
      phcName: data.phc_name ?? undefined,
      active: data.is_active ?? true,
      createdAt: data.created_at ?? new Date().toISOString(),
      lastLoginAt: data.last_login_at ?? undefined,
    }
  },

  async updateMe(payload: UpdateMePayload): Promise<ProfileUser> {
    const { data } = await api.put<RawUser>('/auth/me', {
      full_name: payload.fullName,
      email: payload.email,
      avatar_url: payload.avatarUrl,
      language: payload.language,
      employee_id: payload.employeeId,
    })
    return {
      id: data.id,
      role: data.role,
      phone: data.phone,
      email: data.email ?? undefined,
      fullName: data.full_name,
      language: data.language ?? undefined,
    }
  },
}
