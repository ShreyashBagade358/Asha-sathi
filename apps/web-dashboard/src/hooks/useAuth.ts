import { useAuthStore } from '@/stores/auth.store'
import type { User } from '@/types'

export function useAuth(): {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isHydrating: boolean
  requestOtp: (phone: string) => Promise<{ otpRequestId: string; expiresIn: number }>
  verifyOtp: (phone: string, otp: string, otpRequestId?: string) => Promise<User>
  logout: () => Promise<void>
  hydrate: () => Promise<void>
} {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isHydrating = useAuthStore((s) => s.isHydrating)
  const requestOtp = useAuthStore((s) => s.requestOtp)
  const verifyOtp = useAuthStore((s) => s.verifyOtp)
  const logout = useAuthStore((s) => s.logout)
  const hydrate = useAuthStore((s) => s.hydrate)

  return { user, token, isAuthenticated, isHydrating, requestOtp, verifyOtp, logout, hydrate }
}
