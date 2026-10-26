import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { authApi, syncApi } from './api';
import { tokenStore } from './tokenStore';
import { fetchMyRegion } from '../data/region';
import { metadata, resetLocalData } from '../db/database';
import { scheduleSync } from '../sync/network';
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

/**
 * The credentials are valid but belong to a different user type than the login
 * screen's picker declared. It is thrown before any session side effect runs,
 * so picking the wrong pill can never wipe the account that is already on this
 * device, persist a session for the wrong identity and then have to undo it.
 */
export class RoleMismatchError extends Error {
  constructor(
    readonly expectedRole: string,
    readonly actualRole: string,
  ) {
    super(`Expected a ${expectedRole} account but this login is ${actualRole}`);
    this.name = 'RoleMismatchError';
  }
}

export async function login(
  phone: string,
  password: string,
  expectedRole?: string,
): Promise<UserSummary> {
  const deviceId = await getDeviceId();
  const response = await authApi.login(phone, password, deviceId);
  if (expectedRole && response.user.role !== expectedRole) {
    throw new RoleMismatchError(expectedRole, response.user.role);
  }
  await tokenStore.saveLastPhone(phone);
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
  await tokenStore.saveLastPhone(phone);
  return completeLogin(response, deviceId);
}

async function completeLogin(response: LoginResponse, deviceId: string): Promise<UserSummary> {
  await tokenStore.save({
    accessToken: response.tokens.access_token,
    refreshToken: response.tokens.refresh_token,
    user: response.user,
  });

  // Every login starts from a clean slate. The sync engine only upserts —
  // it never deletes rows that fell out of scope — so a re-login as the
  // *same* account used to keep whatever the previous session synced (an
  // ASHA's whole catchment, demo seed rows, ...). Wiping unconditionally
  // means the patient screens can only ever render rows this session's
  // scope actually delivered. Login is the one moment guaranteed to be
  // online, and scheduleSync() below re-pulls immediately.
  try {
    await resetLocalData();
  } catch (error) {
    console.warn('[auth] local data reset failed', error);
  }

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

  // Login is the one moment guaranteed to be online: cache the worker's
  // state / district / village right here so the registration forms have
  // their dropdown data on a phone that spends the rest of the day offline.
  try {
    await fetchMyRegion();
  } catch (error) {
    console.warn('[auth] region cache warm failed', error);
  }

  // The tabs render from SQLite, and the network watcher only syncs on an
  // offline -> online edge — a phone that stays online would never pull after
  // login, leaving an empty shell. Kick a sync for this session now.
  scheduleSync();

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
    const accessToken = await tokenStore.getAccessToken();
    const refreshToken = await tokenStore.getRefreshToken();
    // me() 401s clear the store while this call is in flight; writing the
    // empty read back would resurrect a session that no longer exists.
    if (!accessToken || !refreshToken) return null;
    await tokenStore.save({ accessToken, refreshToken, user: fresh });
    return fresh;
  } catch {
    // A refused session is over (the store is already empty), but a phone
    // that simply cannot reach the server keeps its cached profile.
    return (await tokenStore.getAccessToken()) ? cached : null;
  }
}

export async function logout(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    // Local sign-out regardless.
  }
  await tokenStore.clear();
  // The device is shared: leave no patient data behind for the next account.
  try {
    await resetLocalData();
  } catch (error) {
    console.warn('[auth] local data reset failed on logout', error);
  }
}
