import { api } from '@/lib/api'
import type { Role, User } from '@/types'

export interface LoginResponse {
  otpRequestId?: string
  expiresIn?: number
  message?: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

interface BackendTokenPair {
  access_token: string
  refresh_token: string
}

interface BackendUserSummary {
  id: string
  phone: string
  full_name: string
  role: string
  language?: string
}

interface BackendUser {
  id: string
  role: string
  employee_id?: string | null
  phone: string
  email?: string | null
  full_name: string
  language?: string
  is_active?: boolean
  last_login_at?: string | null
  created_at?: string
  state_id?: string
}

interface VerifyOtpResponse {
  tokens: BackendTokenPair
  user: BackendUserSummary
}

function toUser(raw: BackendUserSummary | BackendUser): User {
  const full = raw as BackendUser
  return {
    id: raw.id,
    role: raw.role as Role,
    fullName: raw.full_name,
    phone: raw.phone,
    email: full.email ?? undefined,
    language: full.language ?? raw.language,
    stateId: full.state_id ?? '',
    active: full.is_active ?? true,
    createdAt: full.created_at ?? new Date().toISOString(),
    lastLoginAt: full.last_login_at ?? undefined,
  }
}

export const authService = {
  async login(phone: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/otp/send', { phone })
    return data
  },

  async verifyOtp(phone: string, otp: string, otpRequestId?: string): Promise<{ tokens: TokenPair; user: User }> {
    const { data } = await api.post<VerifyOtpResponse>('/auth/otp/verify', {
      phone,
      otp,
      otpRequestId,
    })
    return {
      tokens: { accessToken: data.tokens.access_token, refreshToken: data.tokens.refresh_token },
      user: toUser(data.user),
    }
  },

  async refresh(refreshToken: string): Promise<TokenPair> {
    const { data } = await api.post<BackendTokenPair>('/auth/token/refresh', { refreshToken })
    return { accessToken: data.access_token, refreshToken: data.refresh_token }
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<BackendUser>('/auth/me')
    return toUser(data)
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout')
    } catch {
      // Best-effort logout; session is cleared client-side regardless.
    }
  },
}
