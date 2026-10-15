import { useAuthStore } from '@/stores/auth.store'
import type { User } from '@/types'

export function useAuth(): {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isHydrating: boolean
  signIn: (phone: string, password: string) => Promise<User>
  signInWithOtp: (phone: string, otp: string) => Promise<User>
  logout: () => Promise<void>
  hydrate: () => Promise<void>
} {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isHydrating = useAuthStore((s) => s.isHydrating)
  const signIn = useAuthStore((s) => s.signIn)
  const signInWithOtp = useAuthStore((s) => s.signInWithOtp)
  const logout = useAuthStore((s) => s.logout)
  const hydrate = useAuthStore((s) => s.hydrate)

  return { user, token, isAuthenticated, isHydrating, signIn, signInWithOtp, logout, hydrate }
}
