import { create } from 'zustand'
import { clearSession, readTokens, writeTokens } from '@/lib/api'
import { authService } from '@/services/auth.service'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isHydrating: boolean
  requestOtp: (phone: string) => Promise<{ otpRequestId: string; expiresIn: number }>
  verifyOtp: (phone: string, otp: string, otpRequestId?: string) => Promise<User>
  logout: () => Promise<void>
  hydrate: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrating: false,

  requestOtp: async (phone) => {
    const res = await authService.login(phone)
    return { otpRequestId: res.otpRequestId, expiresIn: res.expiresIn }
  },

  verifyOtp: async (phone, otp, otpRequestId) => {
    const res = await authService.verifyOtp(phone, otp, otpRequestId)
    writeTokens(res.accessToken, res.refreshToken)
    set({ user: res.user, token: res.accessToken, isAuthenticated: true })
    return res.user
  },

  logout: async () => {
    await authService.logout()
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
