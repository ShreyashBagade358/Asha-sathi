import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'

export const TOKEN_KEY = 'asha_sathi_token'
export const REFRESH_TOKEN_KEY = 'asha_sathi_refresh_token'
export const REMEMBERED_PHONE_KEY = 'asha_sathi_remembered_phone'
export const REMEMBERED_PASSWORD_KEY = 'asha_sathi_remembered_password'

export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let pendingQueue: Array<(token: string | null) => void> = []

function flushQueue(token: string | null): void {
  pendingQueue.forEach((cb) => cb(token))
  pendingQueue = []
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refreshToken) return null
  try {
    const { data } = await axios.post(
      `${api.defaults.baseURL}/auth/token/refresh`,
      { refresh_token: refreshToken },
      { timeout: 10_000 },
    )
    const newToken: string | undefined = data?.access_token ?? data?.tokens?.access_token
    const newRefresh: string | undefined = data?.refresh_token ?? data?.tokens?.refresh_token
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken)
      if (newRefresh) localStorage.setItem(REFRESH_TOKEN_KEY, newRefresh)
      return newToken
    }
    return null
  } catch {
    return null
  }
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const status = error.response?.status
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean } | undefined
    const url = originalRequest?.url ?? ''

    if (status === 401 && !url.includes('/auth/') && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`
              originalRequest._retry = true
              resolve(api(originalRequest))
            } else {
              reject(error)
            }
          })
        })
      }

      isRefreshing = true
      originalRequest._retry = true
      const newToken = await tryRefresh()
      flushQueue(newToken)
      isRefreshing = false

      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      }

      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }

    return Promise.reject(error)
  },
)

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function readTokens(): { token: string | null; refreshToken: string | null } {
  return {
    token: localStorage.getItem(TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  }
}

export function writeTokens(token: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function readRememberedPhone(): string | null {
  try {
    return localStorage.getItem(REMEMBERED_PHONE_KEY)
  } catch {
    return null
  }
}

export function writeRememberedPhone(phone: string): void {
  try {
    localStorage.setItem(REMEMBERED_PHONE_KEY, phone)
  } catch {
    // storage unavailable — prefill simply won't happen
  }
}

export function clearRememberedPhone(): void {
  try {
    localStorage.removeItem(REMEMBERED_PHONE_KEY)
  } catch {
    // nothing to do
  }
}

export function readRememberedPassword(): string | null {
  try {
    return localStorage.getItem(REMEMBERED_PASSWORD_KEY)
  } catch {
    return null
  }
}

export function writeRememberedPassword(password: string): void {
  try {
    localStorage.setItem(REMEMBERED_PASSWORD_KEY, password)
  } catch {
    // storage unavailable
  }
}

export function clearRememberedPassword(): void {
  try {
    localStorage.removeItem(REMEMBERED_PASSWORD_KEY)
  } catch {
    // nothing to do
  }
}
