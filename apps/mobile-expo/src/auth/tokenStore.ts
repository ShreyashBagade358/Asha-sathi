import * as SecureStore from 'expo-secure-store';

import type { UserSummary } from '../types';

const TOKEN_KEY = 'asha_access_token';
const REFRESH_KEY = 'asha_refresh_token';
const USER_KEY = 'asha_user';

const isDevice = typeof SecureStore.setItemAsync === 'function';

/**
 * Token storage.
 *
 * expo-secure-store is backed by the iOS keychain and Android keystore. On
 * web (and in tests) it is unavailable, so we fall back to an in-memory map -
 * tokens simply do not survive a reload there, which is acceptable because the
 * phone app is the supported target.
 */
const memory = new Map<string, string>();

async function readRaw(key: string): Promise<string | null> {
  if (isDevice) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return memory.get(key) ?? null;
    }
  }
  return memory.get(key) ?? null;
}

async function writeRaw(key: string, value: string): Promise<void> {
  memory.set(key, value);
  if (isDevice) {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      // A keystore failure must not block login; the in-memory copy is enough
      // for the current session.
      console.warn('[auth] secure store write failed', error);
    }
  }
}

async function deleteRaw(key: string): Promise<void> {
  memory.delete(key);
  if (isDevice) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Already gone; nothing to do.
    }
  }
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: UserSummary | null;
}

export const tokenStore = {
  async getAccessToken(): Promise<string | null> {
    return readRaw(TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return readRaw(REFRESH_KEY);
  },

  async getUser(): Promise<UserSummary | null> {
    const raw = await readRaw(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserSummary;
    } catch {
      return null;
    }
  },

  async save(session: {
    accessToken: string;
    refreshToken: string;
    user?: UserSummary | null;
  }): Promise<void> {
    await writeRaw(TOKEN_KEY, session.accessToken);
    await writeRaw(REFRESH_KEY, session.refreshToken);
    if (session.user) {
      await writeRaw(USER_KEY, JSON.stringify(session.user));
    }
  },

  async setAccessToken(token: string): Promise<void> {
    await writeRaw(TOKEN_KEY, token);
  },

  async clear(): Promise<void> {
    await Promise.all([deleteRaw(TOKEN_KEY), deleteRaw(REFRESH_KEY), deleteRaw(USER_KEY)]);
  },
};
