import { syncApi } from '../auth/api';
import { tokenStore } from '../auth/tokenStore';
import { config } from '../config';
import { upsertRows } from '../db/clinical';
import { flushPendingPhotos } from './photos';
import { writeDenial } from './scope';
import { ALL_TABLES, isTableName, type TableName } from '../db/tables';
import {
  clearConflict,
  dequeue,
  enqueue,
  getConflicts,
  getDatabase,
  getPullWatermark,
  getQueueCounts,
  markQueueState,
  recordConflict,
  setPullWatermark,
  adoptPushedVersion,
  metadata,
  getPendingQueue,
} from '../db/database';
import type { QueueItem, SyncPullResponse, SyncStatusResponse } from '../types';

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
/**
 * Server refusals this engine will absorb before a row is parked as `failed`
 * for a manual Retry. Transport failures (no response at all) do not spend
 * this budget - an unreachable network says nothing about the operation - and
 * are rate-limited by the network layer's backoff instead.
 */
const MAX_ATTEMPTS = 5;

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

/**
 * Tables pulled from the server and applied to SQLite, in dependency order so a
 * parent row is always stored before its children. This is every table the
 * backend scopes to the signed-in user that the app also has a local table for;
 * only `death_reports` remains server-only (no local table yet).
 */
const PULL_TABLES: readonly TableName[] = ALL_TABLES;

/** One request's row budget, mirroring `SyncPullRequest.limit`. */
const PULL_LIMIT = config.pullLimit;
/**
 * Requests one pull may spend. The fast path is a single batched request; the
 * rest drain tables the server truncated. Bounded so a server that never stops
 * paging cannot hold the device in a sync loop.
 */
const MAX_PULL_REQUESTS = 40;

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

  // Refuse locally what the server would refuse anyway (`sync_scope.py`), so
  // a row a patient account may never push fails once, visibly, instead of
  // burning its whole retry budget on `forbidden` responses.
  const role = (await tokenStore.getUser())?.role ?? null;
  const allowed: QueueItem[] = [];
  for (const item of items) {
    const denial = writeDenial(role, item.entity);
    if (denial) {
      await markQueueState(item.clientRequestId, 'failed', denial, { countAttempt: true });
      result.failed += 1;
    } else {
      allowed.push(item);
    }
  }
  if (allowed.length === 0) {
    result.ok = result.failed === 0;
    return result;
  }

  const deviceId = (await metadata.get('device_id')) ?? 'unknown-device';

  // Mark first so a crash mid-flight leaves a visible "syncing" row rather
  // than silently re-sending (recovered by `recoverStuckQueue` on next launch).
  for (const item of allowed) {
    await markQueueState(item.clientRequestId, 'syncing');
  }

  let response;
  try {
    response = await syncApi.push({
      device_id: deviceId,
      operations: allowed.map((item: QueueItem) => ({
        client_request_id: item.clientRequestId,
        entity: item.entity,
        operation: item.operation,
        id: item.recordId,
        version: item.version,
        data: item.data,
      })),
    });
  } catch (error) {
    // No response: the server never saw the batch. Put everything back to
    // pending for a later retry - this is the network's failure, not the
    // row's, so it must not consume retry budget.
    const message = errorMessage(error, 'push failed');
    for (const item of allowed) {
      await markQueueState(item.clientRequestId, 'pending', message);
    }
    return { ...result, ok: false, error: message };
  }

  const handled = new Set<string>();
  for (const outcome of response.results) {
    const clientRequestId = outcome.client_request_id;
    const item = clientRequestId ? allowed.find((i) => i.clientRequestId === clientRequestId) : undefined;
    if (!clientRequestId || !item) continue;
    handled.add(clientRequestId);
    const attempts = item.attempts;

    if (outcome.status === 'success') {
      // Adopt the server's version before dropping the queue entry, so the next
      // edit to this row is not built on a version the server has passed.
      if (outcome.version != null) {
        await adoptPushedVersion(outcome.entity || item.entity, item.recordId, outcome.version);
      }
      await dequeue(clientRequestId);
      result.pushed += 1;
    } else if (outcome.status === 'conflict') {
      // Keep the local change out of the queue but record it so the user can
      // review. The server row is written to the conflict table, not applied
      // over the local one until the user decides.
      await dequeue(clientRequestId);
      await recordConflict({
        clientRequestId,
        entity: outcome.entity,
        recordId: outcome.server_id ?? item.recordId,
        reason: outcome.conflict_reason ?? null,
        serverRecord: outcome.record,
      });
      result.conflicts += 1;
    } else {
      // The server refused this operation. Count the attempt and, once the
      // budget is spent, park the row as `failed` so it stops being resent on
      // every sync until the user retries it.
      const error = outcome.error ?? 'unknown error';
      const spent = attempts + 1 >= MAX_ATTEMPTS;
      await markQueueState(clientRequestId, spent ? 'failed' : 'pending', error, {
        countAttempt: true,
      });
      result.failed += 1;
    }
  }

  // An operation the server answered nothing for would otherwise stay
  // `syncing` forever - invisible to the next push. Send it round again.
  for (const item of allowed) {
    if (!handled.has(item.clientRequestId)) {
      await markQueueState(item.clientRequestId, 'pending', 'no result returned for this operation');
    }
  }

  result.ok = result.failed === 0;
  return result;
}

/** Newest `updated_at` in a page of server rows, or null when there is none. */
function newestUpdatedAt(rows: Array<Record<string, unknown>>): string | null {
  let newest: string | null = null;
  for (const row of rows) {
    const value = row.updated_at;
    if (typeof value !== 'string' || value.length === 0) continue;
    if (newest === null || timestamp(value) > timestamp(newest)) newest = value;
  }
  return newest;
}

/** Parse for ordering only; an unparseable stamp sorts last, never first. */
function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

/**
 * Store one pull page and record how far each answered table is now covered.
 *
 * A page proves coverage only up to what it can vouch for:
 * - no truncation, or an empty answer -> everything up to `server_time`;
 * - a truncated page of rows -> up to its newest `updated_at`, because rows
 *   after that point may have been cut and must be asked for again.
 *
 * Rows are upserted by primary key, so re-requesting a boundary row next page
 * is free of duplicates. Throws on a storage failure, which leaves the stored
 * watermark untouched so the next pull retries the same rows.
 */
async function applyPullPage(
  tables: readonly TableName[],
  response: SyncPullResponse,
  cover: Map<TableName, string>,
  result: SyncResult,
): Promise<Set<TableName>> {
  const records = response.records ?? {};
  const finished = new Set<TableName>();
  for (const table of tables) {
    const rows = records[table];
    // Absent means the server's budget ran out before it reached this table.
    if (!Array.isArray(rows)) continue;

    await upsertRows(table, rows as Array<Record<string, unknown>>);
    result.pulled += rows.length;

    const complete = !response.has_more || rows.length === 0;
    const boundary = complete ? response.server_time : newestUpdatedAt(rows as Array<Record<string, unknown>>);
    if (boundary) {
      const current = cover.get(table);
      if (!current || timestamp(boundary) > timestamp(current)) cover.set(table, boundary);
    }
    if (complete) finished.add(table);
  }
  return finished;
}

export async function pullChanges(): Promise<SyncResult> {
  const result: SyncResult = { ...EMPTY_RESULT, ok: true };
  const deviceId = (await metadata.get('device_id')) ?? 'unknown-device';
  const start = await getPullWatermark();

  // Per-table coverage: the watermark this table may safely be re-read from.
  // It starts at the stored watermark and only ever moves forward, to the
  // point a page vouched for.
  const cover = new Map<TableName, string>(PULL_TABLES.map((table) => [table, start]));
  let requests = 0;

  const request = (watermark: string, tables: TableName[]): Promise<SyncPullResponse> => {
    requests += 1;
    return syncApi.pull({ device_id: deviceId, last_pull_at: watermark, tables, limit: PULL_LIMIT });
  };

  // Fast path: one request for every table. A sync with little to download
  // finishes here; the drain below only runs when the server truncated.
  let response: SyncPullResponse;
  try {
    response = await request(start, [...PULL_TABLES]);
  } catch (error) {
    return { ...result, error: errorMessage(error, 'pull failed') };
  }

  let finished: Set<TableName>;
  try {
    finished = await applyPullPage(PULL_TABLES, response, cover, result);
  } catch (error) {
    // Storage failure: the watermark stays where it is, so the next pull
    // asks for these rows again.
    return { ...result, error: errorMessage(error, 'could not store pulled rows') };
  }

  // Drain: every table the fast path could not finish, one request each, from
  // that table's own coverage point. Sharing one watermark across tables here
  // is what drops rows - a backlog in table A would push the watermark past
  // table B's unseen rows - so each request names only the table it is safe for.
  for (const table of PULL_TABLES) {
    while (!finished.has(table) && requests < MAX_PULL_REQUESTS) {
      const watermark = cover.get(table) ?? start;
      let page: SyncPullResponse;
      try {
        page = await request(watermark, [table]);
      } catch (error) {
        return { ...result, error: errorMessage(error, 'pull failed') };
      }
      try {
        const done = await applyPullPage([table], page, cover, result);
        for (const name of done) finished.add(name);
      } catch (error) {
        return { ...result, error: errorMessage(error, 'could not store pulled rows') };
      }
      if (finished.has(table)) break;
      // Same boundary again: the page carried no rows beyond the one we asked
      // to resume from. Leave the coverage where it is and retry next sync.
      if ((cover.get(table) ?? start) === watermark) break;
    }
  }

  // The stored watermark is the *oldest* coverage point: rows a later table
  // never received still fall inside that window and are re-requested next
  // sync. Taking any single table's point would skip them silently.
  let oldest: string | null = null;
  for (const value of cover.values()) {
    if (oldest === null || timestamp(value) < timestamp(oldest)) oldest = value;
  }
  const nextWatermark = oldest && timestamp(oldest) > timestamp(start) ? oldest : start;
  await setPullWatermark(nextWatermark);
  await metadata.set('last_sync_at', new Date().toISOString());

  const complete = finished.size === PULL_TABLES.length;
  result.hasMore = !complete;
  result.partial = !complete;
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

  // Profile photos park until their beneficiary row exists server-side, so
  // they flush after a successful push+pull (covers offline registrations
  // syncing after reconnection). Never fails the sync itself.
  try {
    await flushPendingPhotos();
  } catch (error) {
    console.warn('[sync] photo flush failed', error);
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
export async function resolveConflictKeepServer(clientRequestId: string): Promise<void> {
  const conflict = (await getConflicts()).find((row) => row.clientRequestId === clientRequestId);
  if (conflict && conflict.serverRecord && isTableName(conflict.entity)) {
    await upsertRows(conflict.entity, [conflict.serverRecord as Record<string, unknown>]);
  }
  await clearConflict(clientRequestId);
}

/**
 * Keep the local edit, discarding the server's version.
 *
 * The push that produced the conflict was already dequeued, so the local row
 * still holds the ASHA's values while the server row sits in `sync_conflicts`.
 * Re-queue the local row as an update at the *server's* version (the server
 * rejects `version < server_version`, and accepts anything at or above it), so
 * the next push overwrites the server row instead of colliding again. The
 * client_request_id is fresh: the server replays a stored result for an id it
 * has already processed, which would re-report the original conflict forever.
 */
export async function resolveConflictKeepMine(clientRequestId: string): Promise<void> {
  const conflict = (await getConflicts()).find((row) => row.clientRequestId === clientRequestId);
  if (conflict && isTableName(conflict.entity)) {
    const db = await getDatabase();
    const local = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM ${conflict.entity} WHERE id = ?`,
      conflict.recordId,
    );
    if (local) {
      const serverVersion = Number(
        (conflict.serverRecord as { version?: number } | null)?.version ?? 0,
      );
      await enqueue({
        clientRequestId: `${clientRequestId}-keep-mine`,
        entity: conflict.entity,
        operation: 'update',
        recordId: conflict.recordId,
        version: Math.max(Number(local.version ?? 1), serverVersion),
        data: local,
      });
    }
  }
  await clearConflict(clientRequestId);
}
