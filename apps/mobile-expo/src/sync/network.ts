import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { AppState } from 'react-native';

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
/**
 * Automatic attempts left for the current online stretch. NetInfo reports
 * "online" the moment the radio associates, but DNS and routes often take a
 * few more seconds; the first auto-sync after a reconnect can therefore fail
 * with a transport error even though the network is about to work. Retrying
 * with backoff here means the ASHA does not have to open Sync Center and
 * press the button herself. Any successful sync, or any manual Sync Now,
 * resets the budget; going offline resets it too.
 */
let autoRetriesLeft = 0;
const AUTO_RETRY_DELAYS_MS = [3_000, 8_000, 20_000];

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

  // Coming back online is the trigger; we do not sync while offline. The
  // 4s delay (up from 1.5s) lets DNS/routes finish settling - NetInfo's
  // "reachable" fires as soon as the radio associates, which is usually
  // before the first packet would actually get through.
  if (cameOnline) {
    autoRetriesLeft = AUTO_RETRY_DELAYS_MS.length;
    scheduleSync(4_000);
  } else if (!online) {
    autoRetriesLeft = 0;
  }
}

export function startNetworkWatcher(): () => void {
  if (unsubscribeNetInfo) return unsubscribeNetInfo;

  void NetInfo.fetch().then(handleNetInfo);
  unsubscribeNetInfo = NetInfo.addEventListener(handleNetInfo);
  // A reconnect while the app is backgrounded can miss NetInfo's edge event,
  // so re-check on every foreground - if the network came back meanwhile,
  // handleNetInfo sees the offline -> online transition and schedules the
  // pending sync without anyone pressing a button.
  const appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') void NetInfo.fetch().then(handleNetInfo);
  });

  return () => {
    appStateSubscription.remove();
    unsubscribeNetInfo?.();
    unsubscribeNetInfo = null;
    autoRetriesLeft = 0;
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}

export function scheduleSync(delayMs = 0): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncNow({ automatic: true });
  }, delayMs);
}

/**
 * Transport-level failure: the request never got an HTTP answer (offline,
 * timeout, DNS not ready). Server refusals (4xx/5xx with a body) are not
 * retried here - they are the engine's `failed` path with its own budget.
 */
function isTransportFailure(result: SyncResult): boolean {
  return !result.ok && result.pushed === 0 && result.pulled === 0 && result.failed === 0 && result.conflicts === 0;
}

export async function syncNow(options: { automatic?: boolean } = {}): Promise<SyncResult> {
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

  // A human pressed the button: she is watching, and her attempt is the
  // retry - do not queue another one behind it.
  if (!options.automatic) autoRetriesLeft = 0;

  syncing = true;
  emitSync(null, true);
  try {
    const result = await runFullSync();
    if (result.ok || !isTransportFailure(result) || autoRetriesLeft === 0) {
      autoRetriesLeft = 0;
    } else {
      // The radio said "online" but the request did not get through. The
      // network layer retries with backoff so the queue drains without the
      // ASHA opening Sync Center.
      const attempt = AUTO_RETRY_DELAYS_MS.length - autoRetriesLeft;
      autoRetriesLeft -= 1;
      scheduleSync(AUTO_RETRY_DELAYS_MS[attempt] ?? 20_000);
    }
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
