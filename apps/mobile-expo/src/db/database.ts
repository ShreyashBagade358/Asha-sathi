import * as SQLite from 'expo-sqlite';

import type { Beneficiary, Household, QueueItem, SyncState } from '../types';

/**
 * Local store.
 *
 * SQLite is the source of truth for the UI. Every write is committed locally
 * first and appended to `sync_queue`; the sync engine drains the queue when the
 * network allows. This is what makes the app usable with no connectivity at
 * all - including for the very first login's data, once synced.
 */

const DATABASE_NAME = 'asha-sathi.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initialized = false;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return dbPromise;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS households (
  id            TEXT PRIMARY KEY NOT NULL,
  hhid          TEXT,
  village_id    TEXT,
  asha_id       TEXT,
  address       TEXT,
  consent_given INTEGER DEFAULT 0,
  version       INTEGER DEFAULT 1,
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS beneficiaries (
  id             TEXT PRIMARY KEY NOT NULL,
  beneficiary_id TEXT,
  household_id   TEXT,
  full_name      TEXT NOT NULL,
  gender         TEXT,
  date_of_birth  TEXT,
  age_years      INTEGER,
  age_months     INTEGER,
  phone          TEXT,
  status         TEXT DEFAULT 'active',
  version        INTEGER DEFAULT 1,
  updated_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_beneficiaries_household
  ON beneficiaries (household_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_name
  ON beneficiaries (full_name);

-- Durable outbox. A row is deleted only once the server confirms the write.
CREATE TABLE IF NOT EXISTS sync_queue (
  client_request_id TEXT PRIMARY KEY NOT NULL,
  entity            TEXT NOT NULL,
  operation         TEXT NOT NULL,
  record_id         TEXT NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1,
  data              TEXT NOT NULL,
  state             TEXT NOT NULL DEFAULT 'pending',
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_state ON sync_queue (state);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue (created_at);

-- Key/value metadata: pull watermark, last sync, device id.
CREATE TABLE IF NOT EXISTS sync_metadata (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

-- Conflicts surface in the UI instead of silently overwriting.
CREATE TABLE IF NOT EXISTS sync_conflicts (
  client_request_id TEXT PRIMARY KEY NOT NULL,
  entity            TEXT NOT NULL,
  record_id         TEXT NOT NULL,
  reason            TEXT,
  server_record     TEXT,
  created_at        TEXT NOT NULL
);
`;

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;
  const db = await getDatabase();
  await db.execAsync(SCHEMA);
  initialized = true;
}

export const metadata = {
  async get(key: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string | null }>(
      'SELECT value FROM sync_metadata WHERE key = ?',
      key,
    );
    return row?.value ?? null;
  },

  async set(key: string, value: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT INTO sync_metadata (key, value) VALUES (?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  },
};

/**
 * Initial pull watermark.
 *
 * A brand-new device starts at the epoch so the first sync pulls the worker's
 * whole area rather than an arbitrary recent window.
 */
export const EPOCH_WATERMARK = '1970-01-01T00:00:00.000Z';

export async function getPullWatermark(): Promise<string> {
  return (await metadata.get('last_pull_at')) ?? EPOCH_WATERMARK;
}

export async function setPullWatermark(value: string): Promise<void> {
  await metadata.set('last_pull_at', value);
}

// --- Queue ----------------------------------------------------------------

export async function enqueue(
  item: Omit<QueueItem, 'state' | 'attempts' | 'lastError' | 'createdAt'> &
    Partial<Pick<QueueItem, 'state' | 'attempts' | 'lastError' | 'createdAt'>>,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sync_queue
       (client_request_id, entity, operation, record_id, version, data, state, attempts, last_error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(client_request_id) DO UPDATE SET
       data = excluded.data,
       state = 'pending',
       last_error = NULL`,
    item.clientRequestId,
    item.entity,
    item.operation,
    item.recordId,
    item.version,
    JSON.stringify(item.data),
    item.state ?? 'pending',
    item.attempts ?? 0,
    item.lastError ?? null,
    item.createdAt ?? new Date().toISOString(),
  );
}

function rowToQueueItem(row: Record<string, unknown>): QueueItem {
  return {
    clientRequestId: String(row.client_request_id),
    entity: String(row.entity),
    operation: row.operation as QueueItem['operation'],
    recordId: String(row.record_id),
    version: Number(row.version ?? 1),
    data: JSON.parse(String(row.data ?? '{}')) as Record<string, unknown>,
    state: row.state as SyncState,
    attempts: Number(row.attempts ?? 0),
    lastError: row.last_error === null ? null : String(row.last_error),
    createdAt: String(row.created_at),
  };
}

export async function getPendingQueue(limit = 100): Promise<QueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM sync_queue
      WHERE state IN ('pending', 'failed')
      ORDER BY created_at ASC
      LIMIT ?`,
    limit,
  );
  return rows.map(rowToQueueItem);
}

export async function getQueueCounts(): Promise<Record<SyncState, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ state: SyncState; count: number }>(
    'SELECT state, COUNT(*) as count FROM sync_queue GROUP BY state',
  );
  const counts: Record<SyncState, number> = {
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
    conflict: 0,
  };
  for (const row of rows) counts[row.state] = Number(row.count);
  return counts;
}

export async function markQueueState(
  clientRequestId: string,
  state: SyncState,
  lastError?: string | null,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue
        SET state = ?,
            attempts = attempts + CASE WHEN ? = 'failed' THEN 1 ELSE 0 END,
            last_error = ?
      WHERE client_request_id = ?`,
    state,
    state,
    lastError ?? null,
    clientRequestId,
  );
}

export async function dequeue(clientRequestId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE client_request_id = ?', clientRequestId);
}

export async function clearQueue(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue');
}

// --- Conflicts ------------------------------------------------------------

export async function recordConflict(entry: {
  clientRequestId: string;
  entity: string;
  recordId: string;
  reason: string | null;
  serverRecord: unknown;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sync_conflicts (client_request_id, entity, record_id, reason, server_record, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(client_request_id) DO UPDATE SET
       reason = excluded.reason,
       server_record = excluded.server_record`,
    entry.clientRequestId,
    entry.entity,
    entry.recordId,
    entry.reason,
    JSON.stringify(entry.serverRecord ?? null),
    new Date().toISOString(),
  );
}

export async function getConflicts(): Promise<
  Array<{
    clientRequestId: string;
    entity: string;
    recordId: string;
    reason: string | null;
    serverRecord: unknown;
    createdAt: string;
  }>
> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    client_request_id: string;
    entity: string;
    record_id: string;
    reason: string | null;
    server_record: string | null;
    created_at: string;
  }>('SELECT * FROM sync_conflicts ORDER BY created_at DESC');

  return rows.map((row) => ({
    clientRequestId: row.client_request_id,
    entity: row.entity,
    recordId: row.record_id,
    reason: row.reason,
    serverRecord: row.server_record ? JSON.parse(row.server_record) : null,
    createdAt: row.created_at,
  }));
}

export async function clearConflict(clientRequestId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_conflicts WHERE client_request_id = ?', clientRequestId);
}

// --- Entity tables --------------------------------------------------------

/** Columns written from a server payload. Unknown keys are ignored. */
const HOUSEHOLD_COLUMNS = [
  'id', 'hhid', 'village_id', 'asha_id', 'address', 'consent_given', 'version', 'updated_at',
] as const;

const BENEFICIARY_COLUMNS = [
  'id', 'beneficiary_id', 'household_id', 'full_name', 'gender', 'date_of_birth',
  'age_years', 'age_months', 'phone', 'status', 'version', 'updated_at',
] as const;

type BindValue = string | number | boolean | null;

/**
 * Pull the listed columns out of a server payload, coercing to SQLite bind
 * values. Booleans become 0/1 and anything exotic becomes a JSON string rather
 * than blowing up mid-transaction.
 */
function pickColumns(
  record: Record<string, unknown>,
  columns: readonly string[],
): BindValue[] {
  return columns.map((column) => {
    const value = record[column];
    if (value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  });
}

export async function upsertHouseholds(records: Array<Record<string, unknown>>): Promise<number> {
  if (records.length === 0) return 0;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const record of records) {
      const values = pickColumns(record, HOUSEHOLD_COLUMNS);
      await db.runAsync(
        `INSERT INTO households (id, hhid, village_id, asha_id, address, consent_given, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           hhid = excluded.hhid,
           village_id = excluded.village_id,
           asha_id = excluded.asha_id,
           address = excluded.address,
           consent_given = excluded.consent_given,
           version = excluded.version,
           updated_at = excluded.updated_at`,
        ...values,
      );
    }
  });
  return records.length;
}

export async function upsertBeneficiaries(records: Array<Record<string, unknown>>): Promise<number> {
  if (records.length === 0) return 0;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const record of records) {
      const values = pickColumns(record, BENEFICIARY_COLUMNS);
      await db.runAsync(
        `INSERT INTO beneficiaries
           (id, beneficiary_id, household_id, full_name, gender, date_of_birth,
            age_years, age_months, phone, status, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           beneficiary_id = excluded.beneficiary_id,
           household_id = excluded.household_id,
           full_name = excluded.full_name,
           gender = excluded.gender,
           date_of_birth = excluded.date_of_birth,
           age_years = excluded.age_years,
           age_months = excluded.age_months,
           phone = excluded.phone,
           status = excluded.status,
           version = excluded.version,
           updated_at = excluded.updated_at`,
        ...values,
      );
    }
  });
  return records.length;
}

export async function listBeneficiaries(search?: string): Promise<Beneficiary[]> {
  const db = await getDatabase();
  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    return db.getAllAsync<Beneficiary>(
      `SELECT * FROM beneficiaries
        WHERE full_name LIKE ? OR beneficiary_id LIKE ? OR phone LIKE ?
        ORDER BY full_name ASC`,
      term,
      term,
      term,
    );
  }
  return db.getAllAsync<Beneficiary>('SELECT * FROM beneficiaries ORDER BY full_name ASC');
}

export async function getBeneficiary(id: string): Promise<Beneficiary | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Beneficiary>('SELECT * FROM beneficiaries WHERE id = ?', id);
}

export async function listHouseholds(): Promise<Household[]> {
  const db = await getDatabase();
  return db.getAllAsync<Household>('SELECT * FROM households ORDER BY hhid ASC');
}

export async function countBeneficiaries(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM beneficiaries',
  );
  return Number(row?.count ?? 0);
}

export async function insertLocalBeneficiary(input: {
  id: string;
  beneficiaryId: string;
  householdId: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO beneficiaries
       (id, beneficiary_id, household_id, full_name, gender, date_of_birth, phone, status, version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?)
     ON CONFLICT(id) DO UPDATE SET
       full_name = excluded.full_name,
       gender = excluded.gender,
       date_of_birth = excluded.date_of_birth,
       phone = excluded.phone`,
    input.id,
    input.beneficiaryId,
    input.householdId,
    input.fullName,
    input.gender,
    input.dateOfBirth,
    input.phone,
    new Date().toISOString(),
  );
}
