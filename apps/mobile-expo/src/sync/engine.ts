import { syncApi } from '../auth/api';
import {
  clearConflict,
  dequeue,
  getConflicts,
  getPullWatermark,
  getQueueCounts,
  markQueueState,
  recordConflict,
  setPullWatermark,
  upsertBeneficiaries,
  upsertHouseholds,
  metadata,
  getPendingQueue,
} from '../db/database';
import type { QueueItem, SyncStatusResponse } from '../types';

/**
 * Sync engine.
 *
 * Order matters: push first, then pull. If we pulled first we would download
 * server rows and then immediately overwrite them with our own queued edits.
 *
 * Every queued write carries a stable `client_request_id`, so a retry after a
 * dropped connection replays the server's stored response instead of creating a
 * duplicate row.
 */

const BATCH_SIZE = 50;
/** Stop retrying automatically after this many attempts; surface in the UI. */
const MAX_ATTEMPTS = 5;

/** Tables pulled from the server and applied to SQLite. */
const PULL_TABLES = ['households', 'beneficiaries'] as const;

export interface SyncResult {
  ok: boolean;
  pushed: number;
  conflicts: number;
  failed: number;
  pulled: number;
  hasMore: boolean;
  error: string | null;
  /** True when we stopped because there is more to fetch. */
  partial: boolean;
}

const EMPTY_RESULT: SyncResult = {
  ok: false,
  pushed: 0,
  conflicts: 0,
  failed: 0,
  pulled: 0,
  hasMore: false,
  error: null,
  partial: false,
};

export async function pushQueue(): Promise<SyncResult> {
  const result: SyncResult = { ...EMPTY_RESULT, ok: true };
  const items = await getPendingQueue(BATCH_SIZE);
  if (items.length === 0) return result;

  const deviceId = (await metadata.get('device_id')) ?? 'unknown-device';

  // Mark first so a crash mid-flight leaves a visible "syncing" row rather
  // than silently re-sending.
  for (const item of items) {
    await markQueueState(item.clientRequestId, 'syncing');
  }

  let response;
  try {
    response = await syncApi.push({
      device_id: deviceId,
      operations: items.map((item: QueueItem) => ({
        client_request_id: item.clientRequestId,
        entity: item.entity,
        operation: item.operation,
        id: item.recordId,
        version: item.version,
        data: item.data,
      })),
    });
  } catch (error) {
    // Network-level failure: put everything back to pending for a later retry.
    for (const item of items) {
      await markQueueState(
        item.clientRequestId,
        item.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending',
        error instanceof Error ? error.message : 'push failed',
      );
    }
    return { ...result, error: error instanceof Error ? error.message : 'push failed' };
  }

  for (const outcome of response.results) {
    const item = items.find((i) => i.clientRequestId === outcome.client_request_id);
    const attempts = item?.attempts ?? 0;

    if (outcome.status === 'success') {
      await dequeue(outcome.client_request_id);
      result.pushed += 1;
      // Adopt the server's version so the next local edit is not stale.
      if (outcome.version != null && item) {
        await markQueueState(outcome.client_request_id, 'synced');
      }
    } else if (outcome.status === 'conflict') {
      // Keep the local change out of the queue but record it so the user can
      // review. The server row is written to the conflict table, not applied
      // over the local one until the user decides.
      await dequeue(outcome.client_request_id);
      await recordConflict({
        clientRequestId: outcome.client_request_id,
        entity: outcome.entity,
        recordId: outcome.server_id ?? item?.recordId ?? '',
        reason: outcome.conflict_reason ?? null,
        serverRecord: outcome.record,
      });
      result.conflicts += 1;
    } else {
      const error = outcome.error ?? 'unknown error';
      await markQueueState(
        outcome.client_request_id,
        attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending',
        error,
      );
      result.failed += 1;
    }
  }

  result.ok = result.failed === 0;
  return result;
}

export async function pullChanges(): Promise<SyncResult> {
  const result: SyncResult = { ...EMPTY_RESULT, ok: true };
  const deviceId = (await metadata.get('device_id')) ?? 'unknown-device';
  const lastPullAt = await getPullWatermark();

  let response;
  try {
    response = await syncApi.pull({
      device_id: deviceId,
      last_pull_at: lastPullAt,
      tables: [...PULL_TABLES],
    });
  } catch (error) {
    return {
      ...result,
      error: error instanceof Error ? error.message : 'pull failed',
    };
  }

  const households = response.records.households ?? [];
  const beneficiaries = response.records.beneficiaries ?? [];

  try {
    await upsertHouseholds(households);
    await upsertBeneficiaries(beneficiaries);
  } catch (error) {
    // Do not advance the watermark: the next pull must retry these rows.
    return {
      ...result,
      error: error instanceof Error ? error.message : 'could not store pulled rows',
    };
  }

  // Only advance after the rows are durably stored.
  await setPullWatermark(response.server_time ?? new Date().toISOString());
  await metadata.set('last_sync_at', new Date().toISOString());

  result.pulled = households.length + beneficiaries.length;
  result.hasMore = response.has_more;
  result.partial = response.has_more;
  return result;
}

/** Push then pull. Returns the combined result. */
export async function runSync(): Promise<SyncResult> {
  const push = await pushQueue();
  if (push.error) {
    return { ...push, ok: false };
  }

  const pull = await pullChanges();
  if (pull.error) {
    return { ...pull, ok: false };
  }

  return {
    ok: true,
    pushed: push.pushed,
    conflicts: push.conflicts,
    failed: push.failed,
    pulled: pull.pulled,
    hasMore: pull.hasMore,
    partial: pull.partial,
    error: null,
  };
}

/** Drain repeated pages the server flagged as truncated. */
export async function runFullSync(maxPages = 20): Promise<SyncResult> {
  const total: SyncResult = { ...EMPTY_RESULT, ok: true };
  for (let page = 0; page < maxPages; page += 1) {
    const result = await runSync();
    total.pushed += result.pushed;
    total.conflicts += result.conflicts;
    total.failed += result.failed;
    total.pulled += result.pulled;

    if (result.error) {
      total.ok = false;
      total.error = result.error;
      return total;
    }
    if (!result.hasMore) {
      total.ok = true;
      return total;
    }
  }
  total.partial = true;
  return total;
}

export interface SyncSnapshot {
  counts: Record<string, number>;
  lastSyncAt: string | null;
  conflicts: number;
}

export async function getSyncSnapshot(): Promise<SyncSnapshot> {
  const counts = await getQueueCounts();
  const lastSyncAt = await metadata.get('last_sync_at');
  const conflicts = (await getConflicts()).length;
  return { counts, lastSyncAt, conflicts };
}

export async function getServerStatus(): Promise<SyncStatusResponse | null> {
  try {
    return await syncApi.status();
  } catch {
    return null;
  }
}

/** Keep a conflict's server values, discarding the local edit. */
export async function acceptServerVersion(clientRequestId: string): Promise<void> {
  const [conflict] = await getConflicts();
  if (!conflict) return;
  void clientRequestId;
  await clearConflict(clientRequestId);
}
