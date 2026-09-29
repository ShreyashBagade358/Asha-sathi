import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import { runFullSync, type SyncResult } from './engine';

type Listener = (online: boolean) => void;
type SyncListener = (result: SyncResult | null, syncing: boolean) => void;

const onlineListeners = new Set<Listener>();
const syncListeners = new Set<SyncListener>();

let isOnline = false;
let syncing = false;
let unsubscribeNetInfo: (() => void) | null = null;
/** Debounce so a flaky connection does not fire a sync per flap. */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function emitOnline(value: boolean): void {
  isOnline = value;
  for (const listener of onlineListeners) listener(value);
}

function emitSync(result: SyncResult | null, busy: boolean): void {
  for (const listener of syncListeners) listener(result, busy);
}

function handleNetInfo(state: NetInfoState): void {
  const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
  const cameOnline = online && !isOnline;

  emitOnline(online);

  // Coming back online is the trigger; we do not sync while offline.
  if (cameOnline) scheduleSync(1500);
}

export function startNetworkWatcher(): () => void {
  if (unsubscribeNetInfo) return unsubscribeNetInfo;

  void NetInfo.fetch().then(handleNetInfo);
  unsubscribeNetInfo = NetInfo.addEventListener(handleNetInfo);

  return () => {
    unsubscribeNetInfo?.();
    unsubscribeNetInfo = null;
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}

export function scheduleSync(delayMs = 0): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncNow();
  }, delayMs);
}

export async function syncNow(): Promise<SyncResult> {
  if (syncing) {
    return {
      ok: false,
      pushed: 0,
      conflicts: 0,
      failed: 0,
      pulled: 0,
      hasMore: false,
      error: 'A sync is already running',
      partial: false,
    };
  }

  syncing = true;
  emitSync(null, true);
  try {
    const result = await runFullSync();
    emitSync(result, false);
    return result;
  } catch (error) {
    const result: SyncResult = {
      ok: false,
      pushed: 0,
      conflicts: 0,
      failed: 0,
      pulled: 0,
      hasMore: false,
      error: error instanceof Error ? error.message : 'sync failed',
      partial: false,
    };
    emitSync(result, false);
    return result;
  } finally {
    syncing = false;
  }
}

export function isCurrentlyOnline(): boolean {
  return isOnline;
}

export function subscribeOnline(listener: Listener): () => void {
  onlineListeners.add(listener);
  listener(isOnline);
  return () => onlineListeners.delete(listener);
}

export function subscribeSync(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}
