import { config } from '../config';
import { tokenStore } from './tokenStore';
import type { LoginResponse, SyncPullResponse, SyncPushResponse, SyncStatusResponse, TokenResponse, UserSummary } from '../types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

/**
 * Single-flight refresh.
 *
 * When several requests 401 at once (a common case right after the app resumes)
 * exactly one refresh call is made; the rest await the same promise. Without
 * this, a queued burst of requests would each burn the refresh token and the
 * user would be logged out at random.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${config.apiBase}/auth/token/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) return false;

      const tokens = (await response.json()) as TokenResponse;
      await tokenStore.save({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Internal: prevents infinite refresh recursion. */
  retryOnUnauthorized?: boolean;
  auth?: boolean;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    retryOnUnauthorized = true,
    auth = true,
    signal,
  } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = await tokenStore.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${config.apiBase}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(
      'Cannot reach the server. Check your connection and the API address in .env.',
      0,
    );
  }

  if (response.status === 401 && auth && retryOnUnauthorized) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, retryOnUnauthorized: false });
    }
    await tokenStore.clear();
    throw new ApiError('Your session has expired. Please log in again.', 401);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const record = payload as { detail?: string; message?: string; code?: string } | null;
    throw new ApiError(
      record?.detail ?? record?.message ?? `Request failed with ${response.status}`,
      response.status,
      record?.code,
    );
  }

  return payload as T;
}

// --- Auth -----------------------------------------------------------------

export const authApi = {
  login(phone: string, password: string, deviceId?: string) {
    return apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { phone, password, device_id: deviceId },
      auth: false,
    });
  },

  me() {
    return apiRequest<UserSummary>('/auth/me');
  },

  logout() {
    return apiRequest<{ message: string }>('/auth/logout', { method: 'POST' });
  },
};

// --- Sync -----------------------------------------------------------------

export const syncApi = {
  push(payload: {
    device_id: string;
    app_version?: string;
    operations: Array<{
      client_request_id: string;
      entity: string;
      operation: string;
      id: string;
      version: number;
      data: Record<string, unknown>;
    }>;
  }) {
    return apiRequest<SyncPushResponse>('/sync/push', { method: 'POST', body: payload });
  },

  pull(payload: {
    device_id: string;
    last_pull_at: string;
    tables?: string[];
    limit?: number;
  }) {
    return apiRequest<SyncPullResponse>('/sync/pull', { method: 'POST', body: payload });
  },

  status() {
    return apiRequest<SyncStatusResponse>('/sync/status');
  },

  registerDevice(payload: { device_id: string; app_version?: string; platform?: string }) {
    return apiRequest<{ device_id: string; registered: boolean }>('/sync/devices/register', {
      method: 'POST',
      body: payload,
    });
  },
};
