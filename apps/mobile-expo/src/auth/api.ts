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
 * Session expiry signal.
 *
 * Dropping the stored tokens is only half of signing the user out: without a
 * signal the ASHA stays parked in a shell that no longer has a session, with
 * every request failing quietly underneath. The root layout subscribes to this
 * and routes to the login screen.
 */
export type SessionExpiredListener = () => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** Subscribe to session expiry. Returns the unsubscribe function. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function notifySessionExpired(): void {
  for (const listener of [...sessionExpiredListeners]) {
    try {
      listener();
    } catch (error) {
      console.warn('[auth] session expiry listener failed', error);
    }
  }
}

/**
 * Destroys the stored session and reports it exactly once per expiry.
 *
 * `hadSession` keeps the signal honest: requests fired while nobody is signed
 * in (an auth endpoint rejecting an anonymous call) clear nothing and must not
 * log anyone out. The refresh path is single-flight, so a burst of requests
 * that 401 together runs this once rather than once per request.
 */
async function expireSession(): Promise<void> {
  const hadSession = Boolean(await tokenStore.getAccessToken());
  await tokenStore.clear();
  if (hadSession) notifySessionExpired();
}

const NETWORK_ERROR_MESSAGE =
  'Cannot reach the server. Check your connection and the API address in .env.';
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';

/** What a failed refresh attempt told us about the session. */
type RefreshOutcome =
  /** New tokens stored; the caller may retry. */
  | 'refreshed'
  /** The server refused the refresh token: the session is over. */
  | 'rejected'
  /** The server could not be asked; the session is still worth keeping. */
  | 'unavailable';

/**
 * Single-flight refresh.
 *
 * When several requests 401 at once (a common case right after the app resumes)
 * exactly one refresh call is made; the rest await the same promise. Without
 * this, a queued burst of requests would each burn the refresh token and the
 * user would be logged out at random.
 *
 * The outcome is three-way on purpose: only an actual refusal ends the
 * session. Treating a dropped connection or a 503 as "refresh failed" would
 * sign the ASHA out for being in a field with no network.
 */
let refreshInFlight: Promise<RefreshOutcome> | null = null;

async function refreshTokens(): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) {
        await expireSession();
        return 'rejected';
      }

      const response = await fetch(`${config.apiBase}/auth/token/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (response.ok) {
        const tokens = (await response.json()) as TokenResponse;
        await tokenStore.save({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        });
        return 'refreshed';
      }
      if (response.status >= 400 && response.status < 500) {
        await expireSession();
        return 'rejected';
      }
      return 'unavailable';
    } catch {
      return 'unavailable';
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
    // A half-up network (Wi-Fi association done, DNS/routes still settling)
    // accepts the socket then stalls. Without a deadline the sync engine sits
    // on this request for the platform's ~60s default, which looks like a
    // hang on the Sync screen. 15s is generous for a LAN API and fails fast
    // enough to trigger the network layer's reconnect retry.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      response = await fetch(`${config.apiBase}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal ?? controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('The server took too long to respond. It will retry automatically.', 0);
    }
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }

  if (response.status === 401 && auth) {
    if (retryOnUnauthorized) {
      const refreshed = await refreshTokens();
      if (refreshed === 'refreshed') {
        return apiRequest<T>(path, { ...options, retryOnUnauthorized: false });
      }
      if (refreshed === 'unavailable') {
        // Not a verdict on the session - the refresh could not be attempted.
        // Throwing a network error here keeps the tokens in the store so a
        // retry once the signal returns can still succeed.
        throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
      }
      // 'rejected': refreshTokens already expired the session (single-flight,
      // so a burst of 401s produces one expiry, not one per request).
      throw new ApiError(SESSION_EXPIRED_MESSAGE, 401);
    }
    // The refreshed token was refused on the retry: the refresh path cannot
    // cover this one, so the session ends here rather than being retried forever.
    await expireSession();
    throw new ApiError(SESSION_EXPIRED_MESSAGE, 401);
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

/** POST /auth/otp/send responds with MessageResponse: { message: string }. */
export interface OtpSendResponse {
  message: string;
}

export const authApi = {
  login(phone: string, password: string, deviceId?: string) {
    return apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { phone, password, device_id: deviceId },
      auth: false,
    });
  },

  otpSend(phone: string) {
    return apiRequest<OtpSendResponse>('/auth/otp/send', {
      method: 'POST',
      body: { phone },
      auth: false,
    });
  },

  /** Same LoginResponse shape as /auth/login: { tokens, user }. */
  otpVerify(phone: string, otp: string, deviceId?: string) {
    return apiRequest<LoginResponse>('/auth/otp/verify', {
      method: 'POST',
      body: { phone, otp, device_id: deviceId },
      auth: false,
    });
  },

  me() {
    return apiRequest<UserSummary>('/auth/me');
  },

  /**
   * PUT /auth/me. Every field on the payload is optional server-side
   * (UserUpdate), so a caller sends only what it is changing - the profile
   * screen pushes just `language`.
   */
  updateMe(payload: { language?: string; fullName?: string }) {
    return apiRequest<UserSummary>('/auth/me', { method: 'PUT', body: payload });
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
