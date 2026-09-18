import { create } from 'zustand'
import { isAxiosError } from 'axios'
import { clearSession, readTokens, writeTokens } from '@/lib/api'
import { authService } from '@/services/auth.service'
import type { User } from '@/types'

function authErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail
    if (status === 404) return 'No account found for this number. Please contact your PHC to get registered.'
    if (status === 401) return typeof detail === 'string' ? detail : 'Invalid or expired OTP. Please try again.'
    if (status === 429) return 'Too many attempts. Please wait a minute and try again.'
    if (!err.response) return 'Cannot reach the server. Check your connection.'
  }
  return fallback
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isHydrating: boolean
  requestOtp: (phone: string) => Promise<{ otpRequestId?: string; expiresIn?: number }>
  verifyOtp: (phone: string, otp: string, otpRequestId?: string) => Promise<User>
  logout: () => Promise<void>
  hydrate: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrating: true,

  requestOtp: async (phone) => {
    try {
      const res = await authService.login(phone)
      return { otpRequestId: res.otpRequestId, expiresIn: res.expiresIn }
    } catch (err) {
      throw new Error(authErrorMessage(err, 'Unable to send OTP. Please try again.'))
    }
  },

  verifyOtp: async (phone, otp, otpRequestId) => {
    try {
      const res = await authService.verifyOtp(phone, otp, otpRequestId)
      writeTokens(res.tokens.accessToken, res.tokens.refreshToken)
      set({ user: res.user, token: res.tokens.accessToken, isAuthenticated: true })
      return res.user
    } catch (err) {
      throw new Error(authErrorMessage(err, 'Invalid OTP'))
    }
  },

  logout: async () => {
    try { await authService.logout() } catch { /* best-effort */ }
    clearSession()
    set({ user: null, token: null, isAuthenticated: false })
  },

  hydrate: async () => {
    const { token } = readTokens()
    if (!token) {
      set({ isAuthenticated: false, isHydrating: false })
      return
    }
    set({ isHydrating: true })
    try {
      const user = await authService.getMe()
      set({ user, token, isAuthenticated: true })
    } catch {
      clearSession()
      set({ user: null, token: null, isAuthenticated: false })
    } finally {
      set({ isHydrating: false })
    }
  },

  setUser: (user) => set({ user, isAuthenticated: true }),
}))

export function useAuthHydrate(): void {
  const hydrate = useAuthStore((s) => s.hydrate)
  hydrate()
}
