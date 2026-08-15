import { api } from '@/lib/api'
import type { User } from '@/types'

export interface LoginResponse {
  otpRequestId: string
  expiresIn: number
}

export interface VerifyOtpResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export const authService = {
  async login(phone: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/otp/send', { phone })
    return data
  },

  async verifyOtp(phone: string, otp: string, otpRequestId?: string): Promise<VerifyOtpResponse> {
    const { data } = await api.post<VerifyOtpResponse>('/auth/otp/verify', {
      phone,
      otp,
      otpRequestId,
    })
    return data
  },

  async refresh(refreshToken: string): Promise<VerifyOtpResponse> {
    const { data } = await api.post<VerifyOtpResponse>('/auth/token/refresh', { refreshToken })
    return data
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<User>('/auth/me')
    return data
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout')
    } catch {
      // Best-effort logout; session is cleared client-side regardless.
    }
  },
}
