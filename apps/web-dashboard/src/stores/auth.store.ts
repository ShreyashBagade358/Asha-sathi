import { create } from 'zustand'
import { isAxiosError } from 'axios'
import { clearSession, readTokens, writeTokens } from '@/lib/api'
import { authService } from '@/services/auth.service'
import { profileService } from '@/services/profile.service'
import type { User } from '@/types'

/**
 * The login response is a summary with no geo scope, so pages that need
 * `user.phcId` (village/household/patient forms) would otherwise never get one.
 * Best-effort: a failed refresh must not block the sign-in itself.
 */
async function withGeoScope(user: User): Promise<User> {
  if (user.phcId) return user
  try {
    return await profileService.getMe()
  } catch {
    return user
  }
}

function authErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail
    if (status === 404) return 'No account found for this number. Please contact your PHC to get registered.'
    if (status === 401) return typeof detail === 'string' ? detail : 'Your session has expired. Please sign in again.'
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
  signIn: (phone: string, password: string) => Promise<User>
  logout: () => Promise<void>
  hydrate: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrating: true,

  signIn: async (phone, password) => {
    try {
      const res = await authService.login(phone, password)
      writeTokens(res.tokens.accessToken, res.tokens.refreshToken)
      const user = await withGeoScope(res.user)
      set({ user, token: res.tokens.accessToken, isAuthenticated: true })
      return user
    } catch (err) {
      // The API returns one message for both an unknown phone and a wrong
      // password, so this copy must not imply which one it was.
      throw new Error(authErrorMessage(err, 'Incorrect phone number or password'))
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
      const user = await profileService.getMe()
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
