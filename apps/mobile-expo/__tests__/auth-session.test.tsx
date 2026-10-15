import { apiRequest, ApiError, onSessionExpired } from '../src/auth/api';
import { login, restoreSession, RoleMismatchError } from '../src/auth/session';
import { tokenStore } from '../src/auth/tokenStore';
import type { UserSummary } from '../src/types';

/**
 * The session lifecycle behind the screens: what a 401 actually costs the
 * user. These are the two ways a session ends (the refresh token is refused,
 * or the refreshed token is refused on the retry) and the two ways it must
 * survive (the refresh server is unreachable, the profile endpoint is
 * unreachable) - a phone in the field that drops its signal must not be signed
 * out, and a revoked session must not leave a shell that looks signed in.
 */

type FetchCall = { url: string; body: Record<string, unknown> | undefined };

let calls: FetchCall[] = [];

function respond(payload: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  };
}

function installFetch(handler: (url: string, init?: { body?: string }) => unknown) {
  const fetchMock = jest.fn(async (url: string, init?: { body?: string }) => {
    calls.push({ url, body: init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : undefined });
    return handler(url, init);
  });
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  return fetchMock;
}

const CACHED_USER: UserSummary = {
  id: 'u1',
  phone: '9876543210',
  full_name: 'Sunita Devi',
  role: 'asha',
  language: 'en',
};

const LOGIN_RESPONSE = {
  tokens: { access_token: 'access-2', refresh_token: 'refresh-2', token_type: 'bearer', expires_in: 1800 },
  user: CACHED_USER,
};

async function seedSession(user: UserSummary | null = CACHED_USER) {
  await tokenStore.save({ accessToken: 'stale-access', refreshToken: 'stale-refresh', user });
}

beforeEach(async () => {
  calls = [];
  await tokenStore.clear();
});

describe('a refused refresh', () => {
  it('clears the tokens and reports the expiry once for a burst of 401s', async () => {
    await seedSession();
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    const fetchMock = installFetch((url) => {
      if (url.includes('/auth/token/refresh')) return respond({ detail: 'Invalid or expired refresh token' }, 401);
      return respond({ detail: 'unauthorized' }, 401);
    });

    const results = await Promise.allSettled([
      apiRequest('/sync/status'),
      apiRequest('/sync/pull', { method: 'POST', body: { device_id: 'd1' } }),
      apiRequest('/auth/me'),
    ]);

    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected']);
    const error = (results[0] as PromiseRejectedResult).reason as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);

    // Single-flight: the whole burst shares one refresh attempt and produces
    // one "session expired", not one per request.
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/token/refresh'))).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);

    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
    await expect(tokenStore.getUser()).resolves.toBeNull();
    unsubscribe();
  });

  it('expires the session when the refreshed token is refused on the retry', async () => {
    await seedSession();
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    installFetch((url) => {
      if (url.includes('/auth/token/refresh')) {
        return respond({ access_token: 'fresh', refresh_token: 'fresh-refresh', token_type: 'bearer', expires_in: 1800 });
      }
      return respond({ detail: 'unauthorized' }, 401);
    });

    await expect(apiRequest('/sync/status')).rejects.toMatchObject({ name: 'ApiError', status: 401 });

    // The old tokens are gone even though the refresh itself succeeded: the
    // server would not accept what it just handed out.
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe('a session that is still worth keeping', () => {
  it('keeps the tokens when the refresh endpoint is unreachable', async () => {
    await seedSession();
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    installFetch((url) => {
      if (url.includes('/auth/token/refresh')) return respond({ detail: 'Service unavailable' }, 503);
      return respond({ detail: 'unauthorized' }, 401);
    });

    const error = (await apiRequest('/sync/status').catch((err: unknown) => err)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    // Reported as a connectivity problem, not as a dead session.
    expect(error.status).toBe(0);
    expect(listener).not.toHaveBeenCalled();

    await expect(tokenStore.getAccessToken()).resolves.toBe('stale-access');
    await expect(tokenStore.getRefreshToken()).resolves.toBe('stale-refresh');
    unsubscribe();
  });

  it('keeps the tokens when the refresh endpoint throws', async () => {
    await seedSession();
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });

    const error = (await apiRequest('/sync/status').catch((err: unknown) => err)) as ApiError;
    expect(error.status).toBe(0);
    expect(listener).not.toHaveBeenCalled();
    await expect(tokenStore.getAccessToken()).resolves.toBe('stale-access');
    unsubscribe();
  });

  it('reports no expiry for a 401 that never had a session behind it', async () => {
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    installFetch(() => respond({ detail: 'unauthorized' }, 401));

    const error = (await apiRequest('/auth/me').catch((err: unknown) => err)) as ApiError;
    expect(error.status).toBe(401);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe('restoreSession', () => {
  it('returns null when the stored session is refused', async () => {
    await seedSession();
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    installFetch((url) => {
      if (url.includes('/auth/token/refresh')) return respond({ detail: 'Invalid or expired refresh token' }, 401);
      return respond({ detail: 'unauthorized' }, 401);
    });

    // Signing in is not a fallback here: the cold-start gate must land on the
    // login screen rather than hand a dead session to the tab shell.
    await expect(restoreSession()).resolves.toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('falls back to the cached profile when the server cannot be reached', async () => {
    await seedSession();
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });

    await expect(restoreSession()).resolves.toEqual(CACHED_USER);
    expect(listener).not.toHaveBeenCalled();
    await expect(tokenStore.getAccessToken()).resolves.toBe('stale-access');
    unsubscribe();
  });

  it('returns null without touching the network when nothing is stored', async () => {
    const fetchMock = installFetch(() => respond({ ok: true }));
    await expect(restoreSession()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('login role guard', () => {
  it('rejects a mismatched user type before any session side effect', async () => {
    const fetchMock = installFetch((url) =>
      url.includes('/auth/login') ? respond(LOGIN_RESPONSE) : respond({ ok: true }),
    );

    const error = (await login('9876543210', 'asha@123', 'patient').catch((err: unknown) => err)) as Error;
    expect(error).toBeInstanceOf(RoleMismatchError);
    expect((error as RoleMismatchError).expectedRole).toBe('patient');
    expect((error as RoleMismatchError).actualRole).toBe('asha');

    // Nothing was persisted, and the previous account on this device is
    // untouched: no device registration, no region warm, no local reset.
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    await expect(tokenStore.getUser()).resolves.toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/sync/'))).toHaveLength(0);
  });

  it('completes the login when the user type matches', async () => {
    installFetch((url) => (url.includes('/auth/login') ? respond(LOGIN_RESPONSE) : respond({ ok: true })));

    await expect(login('9876543210', 'asha@123', 'asha')).resolves.toEqual(CACHED_USER);
    await expect(tokenStore.getAccessToken()).resolves.toBe('access-2');
    await expect(tokenStore.getUser()).resolves.toEqual(CACHED_USER);
  });

  it('still signs in when no user type was declared', async () => {
    installFetch((url) => (url.includes('/auth/login') ? respond(LOGIN_RESPONSE) : respond({ ok: true })));

    await expect(login('9876543210', 'asha@123')).resolves.toEqual(CACHED_USER);
    await expect(tokenStore.getAccessToken()).resolves.toBe('access-2');
  });
});
