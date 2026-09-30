import * as SQLite from 'expo-sqlite';

import type { Beneficiary, Household, QueueItem, SyncState } from '../types';
import { isTableName } from './tables';

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
  abha_id        TEXT,
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


const CLINICAL_SCHEMA = `
-- Generated from the live Postgres schema (information_schema) for the tables
-- the mobile app reads. Kept in sync with the backend's SYNC_TABLES registry.
-- All types are TEXT/INTEGER/REAL because SQLite is dynamically typed and the
-- server serialises dates, times, uuids, json and arrays as strings.
CREATE TABLE IF NOT EXISTS pregnancies (
  beneficiary_id TEXT NOT NULL,
  lmp TEXT,
  edd TEXT,
  gravida INTEGER,
  parity INTEGER,
  abortions INTEGER,
  living_children INTEGER,
  risk_level TEXT NOT NULL,
  risk_factors TEXT,
  risk_score REAL,
  last_anc_date TEXT,
  next_anc_due TEXT,
  anc_count INTEGER NOT NULL,
  status TEXT NOT NULL,
  delivery_outcome_id TEXT,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pregnancies_beneficiary_id ON pregnancies (beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_pregnancies_status ON pregnancies (status);

CREATE TABLE IF NOT EXISTS children (
  beneficiary_id TEXT NOT NULL,
  birth_registration_no TEXT,
  birth_weight_grams INTEGER,
  birth_length_cm REAL,
  head_circumference_cm REAL,
  gestation_weeks INTEGER,
  delivery_type TEXT,
  place_of_birth TEXT,
  apgar_1min INTEGER,
  apgar_5min INTEGER,
  congenital_anomalies TEXT,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_children_beneficiary_id ON children (beneficiary_id);

CREATE TABLE IF NOT EXISTS immunizations (
  child_id TEXT NOT NULL,
  vaccine_code TEXT NOT NULL,
  vaccine_name TEXT,
  dose_number INTEGER NOT NULL,
  due_date TEXT,
  given_date TEXT,
  status TEXT NOT NULL,
  given_by TEXT,
  facility_id TEXT,
  batch_number TEXT,
  expiry_date TEXT,
  route TEXT,
  site TEXT,
  adverse_event TEXT,
  recorded_by TEXT,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_immunizations_child_id ON immunizations (child_id);
CREATE INDEX IF NOT EXISTS idx_immunizations_status ON immunizations (status);

CREATE TABLE IF NOT EXISTS asha_tasks (
  asha_id TEXT NOT NULL,
  task_date TEXT,
  task_type TEXT NOT NULL,
  beneficiary_id TEXT,
  household_id TEXT,
  village_id TEXT,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  scheduled_time TEXT,
  completed_time TEXT,
  gps_latitude REAL,
  gps_longitude REAL,
  gps_accuracy REAL,
  notes TEXT,
  metadata TEXT,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_asha_tasks_status ON asha_tasks (status);
CREATE INDEX IF NOT EXISTS idx_asha_tasks_task_date ON asha_tasks (task_date);
CREATE INDEX IF NOT EXISTS idx_asha_tasks_beneficiary_id ON asha_tasks (beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_asha_tasks_household_id ON asha_tasks (household_id);

CREATE TABLE IF NOT EXISTS referrals (
  beneficiary_id TEXT NOT NULL,
  referred_from_id TEXT,
  referred_from_facility_id TEXT,
  referred_to_facility_id TEXT,
  referred_to_specialist_id TEXT,
  referral_type TEXT NOT NULL,
  urgency TEXT NOT NULL,
  reason TEXT,
  clinical_summary TEXT,
  investigations TEXT,
  provisional_diagnosis TEXT,
  status TEXT NOT NULL,
  initiated_at TEXT,
  accepted_at TEXT,
  completed_at TEXT,
  outcome TEXT,
  feedback_from_receiver TEXT,
  followup_required INTEGER NOT NULL,
  followup_date TEXT,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_referrals_beneficiary_id ON referrals (beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals (status);

CREATE TABLE IF NOT EXISTS ncd_screenings (
  beneficiary_id TEXT NOT NULL,
  screening_date TEXT NOT NULL,
  age_above_30 INTEGER NOT NULL,
  tobacco_use INTEGER NOT NULL,
  alcohol_use INTEGER NOT NULL,
  physical_activity INTEGER NOT NULL,
  waist_circumference_cm REAL,
  family_history_diabetes INTEGER NOT NULL,
  family_history_hypertension INTEGER NOT NULL,
  family_history_cancer INTEGER NOT NULL,
  known_diabetes INTEGER NOT NULL,
  known_hypertension INTEGER NOT NULL,
  known_cancer INTEGER NOT NULL,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  blood_sugar_random REAL,
  cbac_score INTEGER,
  diabetes_risk TEXT,
  hypertension_risk TEXT,
  cardiovascular_risk TEXT,
  cancer_risk TEXT,
  referral_made INTEGER NOT NULL,
  referral_type TEXT,
  referral_facility_id TEXT,
  recorded_by TEXT,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ncd_screenings_beneficiary_id ON ncd_screenings (beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_ncd_screenings_screening_date ON ncd_screenings (screening_date);

CREATE TABLE IF NOT EXISTS anc_visits (
  pregnancy_id TEXT NOT NULL,
  visit_number INTEGER NOT NULL,
  visit_date TEXT NOT NULL,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  weight_kg REAL,
  height_cm REAL,
  bmi REAL,
  temperature REAL,
  pulse INTEGER,
  respiratory_rate INTEGER,
  spo2 REAL,
  hemoglobin REAL,
  blood_group TEXT,
  rh_factor TEXT,
  blood_sugar_random REAL,
  blood_sugar_fasting REAL,
  hba1c REAL,
  urine_protein TEXT,
  urine_sugar TEXT,
  hiv_status TEXT,
  syphilis_status TEXT,
  hbsag_status TEXT,
  fundal_height_cm REAL,
  fetal_heart_rate INTEGER,
  fetal_movement TEXT,
  lie_presentation TEXT,
  danger_signs TEXT,
  clinical_findings TEXT,
  advice_given TEXT,
  referral_made INTEGER NOT NULL,
  referral_reason TEXT,
  referred_facility_id TEXT,
  pmsma_attended INTEGER NOT NULL,
  recorded_by TEXT,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_anc_visits_pregnancy_id ON anc_visits (pregnancy_id);
CREATE INDEX IF NOT EXISTS idx_anc_visits_visit_number ON anc_visits (visit_number);

CREATE TABLE IF NOT EXISTS growth_records (
  child_id TEXT NOT NULL,
  record_date TEXT NOT NULL,
  weight_kg REAL,
  height_cm REAL,
  muac_mm REAL,
  z_score_wfa REAL,
  z_score_hfa REAL,
  z_score_wfh REAL,
  bmi REAL,
  nutrition_status TEXT,
  recorded_by TEXT,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL,
  photo_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_growth_records_child_id ON growth_records (child_id);
CREATE INDEX IF NOT EXISTS idx_growth_records_record_date ON growth_records (record_date);

CREATE TABLE IF NOT EXISTS eligible_couples (
  husband_id TEXT,
  wife_id TEXT NOT NULL,
  registration_date TEXT,
  status TEXT NOT NULL,
  current_method TEXT,
  method_start_date TEXT,
  last_followup_date TEXT,
  next_followup_date TEXT,
  missed_period_tracked INTEGER NOT NULL,
  last_missed_period_date TEXT,
  pregnancy_confirmed INTEGER NOT NULL,
  registered_by TEXT,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eligible_couples_status ON eligible_couples (status);

-- Village / household health surveys captured by the ASHA on the phone. The
-- server already syncs this table; form_data holds the survey answers as JSON
-- so a new question does not need a schema change.
CREATE TABLE IF NOT EXISTS village_forms (
  id TEXT PRIMARY KEY NOT NULL,
  asha_id TEXT NOT NULL,
  form_type TEXT NOT NULL,
  form_date TEXT,
  village_id TEXT,
  form_data TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TEXT,
  verified_by TEXT,
  verified_at TEXT,
  incentive_eligible INTEGER NOT NULL DEFAULT 0,
  incentive_amount REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_village_forms_type_date ON village_forms (form_type, form_date);
CREATE INDEX IF NOT EXISTS idx_village_forms_status ON village_forms (status);
`;

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;
  const db = await getDatabase();
  await db.execAsync(SCHEMA);
  await db.execAsync(CLINICAL_SCHEMA);
  await runAdditiveMigrations(db);
  initialized = true;
}

/**
 * Additive column migrations.
 *
 * The CREATE TABLE statements above are all `IF NOT EXISTS`, so a column added
 * to them later is silently ignored on a device that already has the database -
 * the new field would vanish on the next pull. SQLite has no `ADD COLUMN IF NOT
 * EXISTS`, so each entry is checked against PRAGMA table_info and applied only
 * when absent. This keeps existing installs on the same schema as fresh ones.
 *
 * Only additive changes belong here. Removing or narrowing a column needs a
 * table rebuild.
 */
const ADDED_COLUMNS: Array<{ table: string; column: string; ddl: string }> = [
  // The server has had abha_id on beneficiaries all along; the local table was
  // created before the register form collected it.
  { table: 'beneficiaries', column: 'abha_id', ddl: 'abha_id TEXT' },
];

async function runAdditiveMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const { table, column, ddl } of ADDED_COLUMNS) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (info.length === 0) continue; // table not present in this build
    if (info.some((row) => row.name === column)) continue;
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
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

/**
 * Every outbox row, for the Sync Center's tabbed queue view. `getPendingQueue`
 * deliberately filters to unsent work, so it cannot back a "Synced" tab.
 */
export async function getQueueItems(limit = 200): Promise<QueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM sync_queue
      ORDER BY created_at DESC
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

/**
 * Advance a local row to the version the server assigned after a successful
 * push.
 *
 * The push response carries the new version, but the queue entry is deleted
 * right after, so without this the local row would keep the version the edit was
 * based on. The next edit would then send a version the server has already
 * passed and be rejected as `stale_version`.
 *
 * Only `version` is touched, not the record body: a newer unsynced local edit to
 * the same row must survive.
 */
export async function adoptPushedVersion(entity: string, recordId: string, version: number): Promise<void> {
  // `entity` travels through the outbox, so it is validated against the known
  // table list instead of being interpolated as an identifier.
  if (!isTableName(entity) || !recordId || !Number.isFinite(version)) return;
  const db = await getDatabase();
  await db.runAsync(`UPDATE ${entity} SET version = ? WHERE id = ?`, version, recordId);
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
  abhaId?: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO beneficiaries
       (id, beneficiary_id, household_id, abha_id, full_name, gender, date_of_birth, phone, status, version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?)
     ON CONFLICT(id) DO UPDATE SET
       abha_id = excluded.abha_id,
       full_name = excluded.full_name,
       gender = excluded.gender,
       date_of_birth = excluded.date_of_birth,
       phone = excluded.phone`,
    input.id,
    input.beneficiaryId,
    input.householdId,
    input.abhaId || null,
    input.fullName,
    input.gender,
    input.dateOfBirth,
    input.phone,
    new Date().toISOString(),
  );
}

/**
 * Local write for a household health survey.
 *
 * Follows the same offline-first shape as beneficiary registration: SQLite and
 * the outbox commit before the upload is attempted, so the survey is on the
 * device the moment the ASHA taps save and syncs whenever the network allows.
 * The answers live in `form_data` as JSON, so a new question needs no migration.
 */
export async function insertLocalVillageForm(input: {
  id: string;
  ashaId: string | null;
  formType: string;
  formDate: string;
  villageId: string | null;
  formData: Record<string, unknown>;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO village_forms
       (id, asha_id, form_type, form_date, village_id, form_data, status, submitted_at,
        incentive_eligible, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, 0, ?, ?, 1)
     ON CONFLICT(id) DO UPDATE SET
       form_date = excluded.form_date,
       village_id = excluded.village_id,
       form_data = excluded.form_data,
       status = excluded.status,
       submitted_at = excluded.submitted_at,
       updated_at = excluded.updated_at`,
    input.id,
    input.ashaId ?? '',
    input.formType,
    input.formDate,
    input.villageId,
    JSON.stringify(input.formData),
    now,
    now,
    now,
  );
}
