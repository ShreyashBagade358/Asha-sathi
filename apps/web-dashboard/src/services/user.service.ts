import { api } from '@/lib/api'
import type { Role } from '@/types'

export interface ManagedUser {
  id: string
  fullName: string
  phone: string
  email?: string
  role: Role
  stateId?: string
  stateName?: string
  districtId?: string
  districtName?: string
  blockId?: string
  phcId?: string
  phcName?: string
  active: boolean
  lastLoginAt?: string
}

export interface UserListParams {
  page?: number
  pageSize?: number
  q?: string
  role?: string
}

export interface UserListResult {
  items: ManagedUser[]
  total: number
  page: number
  pageSize: number
}

export interface UserPayload {
  fullName: string
  phone: string
  email?: string
  role: Role
  password?: string
  stateId?: string
  districtId?: string
  blockId?: string
  phcId?: string
  villageId?: string
}

interface RawUser {
  id: string
  full_name: string
  phone: string
  email: string | null
  role: string
  is_active: boolean
  last_login_at: string | null
  state_id: string | null
  state_name: string | null
  district_id: string | null
  district_name: string | null
  block_id: string | null
  phc_id: string | null
  phc_name: string | null
}

const mapUser = (r: RawUser): ManagedUser => ({
  id: r.id,
  fullName: r.full_name,
  phone: r.phone,
  email: r.email ?? undefined,
  role: r.role as Role,
  stateId: r.state_id ?? undefined,
  stateName: r.state_name ?? undefined,
  districtId: r.district_id ?? undefined,
  districtName: r.district_name ?? undefined,
  blockId: r.block_id ?? undefined,
  phcId: r.phc_id ?? undefined,
  phcName: r.phc_name ?? undefined,
  active: r.is_active,
  lastLoginAt: r.last_login_at ?? undefined,
})

export const userService = {
  async list(params: UserListParams = {}): Promise<UserListResult> {
    const { data } = await api.get<{ items: RawUser[]; total: number; page: number; page_size: number }>('/users', {
      params: {
        page: params.page ?? 1,
        page_size: params.pageSize ?? 10,
        q: params.q || undefined,
        role: params.role || undefined,
      },
    })
    return { items: data.items.map(mapUser), total: data.total, page: data.page, pageSize: data.page_size }
  },

  async get(id: string): Promise<ManagedUser & { avatarUrl?: string }> {
    const { data } = await api.get<RawUser & { avatar_url?: string | null }>(`/users/${id}`)
    return { ...mapUser(data), avatarUrl: data.avatar_url ?? undefined }
  },

  async create(payload: UserPayload): Promise<{ user: ManagedUser; password: string }> {
    const { data } = await api.post<RawUser & { password: string }>('/users', {
      full_name: payload.fullName,
      phone: payload.phone,
      email: payload.email || null,
      role: payload.role,
      password: payload.password || undefined,
      state_id: payload.stateId || null,
      district_id: payload.districtId || null,
      block_id: payload.blockId || null,
      phc_id: payload.phcId || null,
      village_id: payload.villageId || null,
    })
    return { user: mapUser(data), password: data.password }
  },

  async update(
    id: string,
    payload: Omit<UserPayload, 'phone'> & { active: boolean },
  ): Promise<ManagedUser> {
    const { data } = await api.put<RawUser>(`/users/${id}`, {
      full_name: payload.fullName,
      email: payload.email || null,
      role: payload.role,
      state_id: payload.stateId || null,
      district_id: payload.districtId || null,
      block_id: payload.blockId || null,
      phc_id: payload.phcId || null,
      is_active: payload.active,
    })
    return mapUser(data)
  },

  async deactivate(id: string): Promise<void> {
    await api.delete(`/users/${id}`)
  },

  /** `POST /users/{id}/avatar` — multipart, returns the public photo URL. */
  async uploadAvatar(userId: string, file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post<{ avatar_url: string }>(`/users/${userId}/avatar`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.avatar_url
  },
}
