import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { authApi, syncApi } from './api';
import { tokenStore } from './tokenStore';
import { metadata } from '../db/database';
import type { LoginResponse, UserSummary } from '../types';

/**
 * A stable per-install id. The backend keys SyncDevice rows and sync logs on
 * it, so it must survive restarts and not change per session.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await metadata.get('device_id');
  if (existing) return existing;

  let deviceId: string;
  try {
    // expo-application-android/ios would be the native route; Constants exposes
    // an install-stable id that works on both without a custom native module.
    const candidate = Constants.expoConfig?.extra?.deviceId as string | undefined;
    deviceId =
      candidate ??
      `${Platform.OS}-${(Constants.sessionId ?? 'session').toString().slice(0, 12)}`;
  } catch {
    deviceId = `${Platform.OS}-${Date.now()}`;
  }

  await metadata.set('device_id', deviceId);
  return deviceId;
}

export interface AuthState {
  user: UserSummary | null;
  loading: boolean;
  error: string | null;
}

export async function login(phone: string, password: string): Promise<UserSummary> {
  const deviceId = await getDeviceId();
  const response = await authApi.login(phone, password, deviceId);
  return completeLogin(response, deviceId);
}

/** POST /auth/otp/send. Returns the server message (it carries the dev OTP). */
export async function requestOtp(phone: string): Promise<string> {
  const response = await authApi.otpSend(phone);
  return response.message;
}

/** POST /auth/otp/verify, then persists the session exactly like password login. */
export async function verifyOtp(phone: string, code: string): Promise<UserSummary> {
  const deviceId = await getDeviceId();
  const response = await authApi.otpVerify(phone, code, deviceId);
  return completeLogin(response, deviceId);
}

async function completeLogin(response: LoginResponse, deviceId: string): Promise<UserSummary> {
  await tokenStore.save({
    accessToken: response.tokens.access_token,
    refreshToken: response.tokens.refresh_token,
    user: response.user,
  });

  // Best effort: a failure here must not block the login.
  try {
    await syncApi.registerDevice({
      device_id: deviceId,
      app_version: Constants.expoConfig?.version,
      platform: Platform.OS,
    });
  } catch (error) {
    console.warn('[auth] device registration failed', error);
  }

  return response.user;
}

export async function restoreSession(): Promise<UserSummary | null> {
  const token = await tokenStore.getAccessToken();
  if (!token) return null;

  const cached = await tokenStore.getUser();
  // Trust the cached profile for the first paint, then confirm in the
  // background so a revoked account does not leave a stale shell.
  try {
    const fresh = await authApi.me();
    await tokenStore.save({
      accessToken: (await tokenStore.getAccessToken()) ?? '',
      refreshToken: (await tokenStore.getRefreshToken()) ?? '',
      user: fresh,
    });
    return fresh;
  } catch {
    return cached;
  }
}

export async function logout(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    // Local sign-out regardless.
  }
  await tokenStore.clear();
}
