import * as SQLite from 'expo-sqlite';

import type { Household, QueueItem, SyncState } from '../types';
import { ALL_TABLES, isTableName } from './tables';

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
  updated_at    TEXT,
  head_name     TEXT
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
  blood_group    TEXT,
  metadata_json  TEXT,
  photo_url      TEXT,
  relationship_to_head TEXT,
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

CREATE TABLE IF NOT EXISTS delivery_outcomes (
  pregnancy_id TEXT NOT NULL,
  delivery_date TEXT,
  place_of_delivery TEXT,
  delivery_type TEXT,
  outcome TEXT,
  birth_weight_grams INTEGER,
  complications TEXT,
  birth_notification_no TEXT,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_delivery_outcomes_pregnancy_id ON delivery_outcomes (pregnancy_id);

CREATE TABLE IF NOT EXISTS pnc_visits (
  pregnancy_id TEXT NOT NULL,
  visit_number INTEGER NOT NULL,
  visit_date TEXT NOT NULL,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  danger_signs_mother TEXT,
  breastfeeding_status TEXT,
  referral_made INTEGER NOT NULL,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pnc_visits_pregnancy_id ON pnc_visits (pregnancy_id);

CREATE TABLE IF NOT EXISTS children (
  beneficiary_id TEXT NOT NULL,
  mother_id TEXT,
  father_id TEXT,
  delivery_outcome_id TEXT,
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

CREATE TABLE IF NOT EXISTS hbnc_visits (
  child_id TEXT NOT NULL,
  visit_number INTEGER NOT NULL,
  visit_date TEXT NOT NULL,
  weight_grams INTEGER,
  danger_signs TEXT,
  referral_made INTEGER NOT NULL,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hbnc_visits_child_id ON hbnc_visits (child_id);

CREATE TABLE IF NOT EXISTS hbyc_visits (
  child_id TEXT NOT NULL,
  visit_number INTEGER NOT NULL,
  visit_date TEXT NOT NULL,
  age_months INTEGER,
  weight_kg REAL,
  muac_mm REAL,
  nutrition_status TEXT,
  referral_made INTEGER NOT NULL,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hbyc_visits_child_id ON hbyc_visits (child_id);

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

CREATE TABLE IF NOT EXISTS referral_followups (
  id TEXT PRIMARY KEY NOT NULL,
  referral_id TEXT NOT NULL,
  followup_date TEXT,
  conducted_by TEXT,
  beneficiary_status TEXT,
  treatment_compliance TEXT,
  complications TEXT,
  further_referral INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_referral_followups_referral_id ON referral_followups (referral_id);

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

CREATE TABLE IF NOT EXISTS disease_cases (
  disease_type TEXT NOT NULL,
  beneficiary_id TEXT,
  village_id TEXT,
  detection_date TEXT,
  diagnosis_date TEXT,
  lab_confirmed INTEGER NOT NULL,
  treatment_started INTEGER NOT NULL,
  treatment_outcome TEXT,
  status TEXT NOT NULL,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_disease_cases_beneficiary_id ON disease_cases (beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_disease_cases_status ON disease_cases (status);
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

CREATE TABLE IF NOT EXISTS ec_followups (
  ec_id TEXT NOT NULL,
  followup_date TEXT NOT NULL,
  method_used TEXT,
  method_changed INTEGER NOT NULL,
  side_effects TEXT,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ec_followups_ec_id ON ec_followups (ec_id);

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

-- One row per family member per visit: the health check the ASHA records
-- while going through the household. Link columns mirror the server, which
-- has no FK here either — the row can be queued before the survey it
-- belongs to exists.
CREATE TABLE IF NOT EXISTS household_visit_checks (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL,
  survey_id TEXT,
  beneficiary_id TEXT,
  check_type TEXT NOT NULL DEFAULT 'general',
  result TEXT NOT NULL DEFAULT 'ok',
  notes TEXT,
  visited_at TEXT,
  created_by TEXT,
  photo_url TEXT,
  created_at TEXT,
  updated_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_household_visit_checks_household
  ON household_visit_checks (household_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  reference_id TEXT,
  reference_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  read_at TEXT,
  metadata TEXT,
  created_at TEXT,
  updated_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type);
`;

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;
  const db = await getDatabase();
  await db.execAsync(SCHEMA);
  await db.execAsync(CLINICAL_SCHEMA);
  await ensureIdUniqueIndexes(db);
  await runAdditiveMigrations(db);
  await recoverStuckQueue(db);
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
  // Intake fields the register form collects: blood group column plus the
  // server's `metadata` column (intake risk / notes / village), stored under
  // the ORM attribute name the pull payload uses.
  { table: 'beneficiaries', column: 'blood_group', ddl: 'blood_group TEXT' },
  { table: 'beneficiaries', column: 'metadata_json', ddl: 'metadata_json TEXT' },
  { table: 'beneficiaries', column: 'photo_url', ddl: 'photo_url TEXT' },
  // Head of family, entered when a household is registered in the field; the
  // server has always had the column, the local table predates it.
  { table: 'households', column: 'head_name', ddl: 'head_name TEXT' },
  // Amenities captured at registration (toilet / electricity / clean water / LPG).
  { table: 'households', column: 'amenities', ddl: 'amenities TEXT' },
  // How a member relates to the household head (family linking); the server
  // column arrived with migration 0009.
  { table: 'beneficiaries', column: 'relationship_to_head', ddl: 'relationship_to_head TEXT' },
  // Child–parent links (migration 0011): mother is required at the API layer,
  // father is optional, delivery_outcome_id joins to the mother's delivery.
  { table: 'children', column: 'mother_id', ddl: 'mother_id TEXT' },
  { table: 'children', column: 'father_id', ddl: 'father_id TEXT' },
  { table: 'children', column: 'delivery_outcome_id', ddl: 'delivery_outcome_id TEXT' },
  // Photos for household visit checks (member photos during household visits).
  { table: 'household_visit_checks', column: 'photo_url', ddl: 'photo_url TEXT' },
];

/**
 * Upsert uses `INSERT … ON CONFLICT(id)`, which SQLite resolves against any
 * unique index on `id` — not only a PRIMARY KEY. Most clinical tables were
 * created with `id TEXT NOT NULL` and no constraint, so the first pull into a
 * fresh install threw "ON CONFLICT clause does not match any PRIMARY KEY or
 * UNIQUE constraint" and silently dropped every row. A unique index is enough
 * to make the upsert work without rebuilding the tables.
 */
const ID_UNIQUE_TABLES = [
  'pregnancies',
  'delivery_outcomes',
  'pnc_visits',
  'children',
  'immunizations',
  'hbnc_visits',
  'hbyc_visits',
  'asha_tasks',
  'referrals',
  'ncd_screenings',
  'disease_cases',
  'anc_visits',
  'growth_records',
  'eligible_couples',
  'ec_followups',
  'notifications',
];

async function ensureIdUniqueIndexes(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const table of ID_UNIQUE_TABLES) {
    await db.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_id ON ${table}(id)`);
  }
}

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

/**
 * Wipe every synced row, the outbox, conflicts and the pull watermark.
 *
 * Called when a different account signs in or on logout: the next session must
 * never inherit the previous user's offline rows, queued pushes must not land
 * under the new identity, and the first pull must be a full one from the epoch
 * instead of an incremental pull measured against someone else's watermark.
 * Key/value metadata goes too - the cached region, the last-sync stamp and the
 * notification read set all describe the previous account. The device id is
 * kept: it identifies the installation, not the user.
 */
export async function resetLocalData(): Promise<void> {
  const db = await getDatabase();
  for (const table of ALL_TABLES) {
    await db.runAsync(`DELETE FROM ${table}`);
  }
  await db.runAsync('DELETE FROM sync_queue');
  await db.runAsync('DELETE FROM sync_conflicts');
  await db.runAsync('DELETE FROM sync_metadata WHERE key <> ?', 'device_id');
  await metadata.set('last_pull_at', EPOCH_WATERMARK);
  emitQueueChange();
}

// --- Outbox subscriptions -------------------------------------------------

type QueueListener = () => void;

const queueListeners = new Set<QueueListener>();

/**
 * Fire when the outbox's set of rows changes (enqueue, dequeue, retry, reset),
 * so a mounted banner or badge can refresh its count instead of polling.
 * State transitions within a push do not fire: the pending/failed totals a
 * subscriber shows do not move when a row goes `pending -> syncing -> gone`.
 */
export function subscribeQueue(listener: QueueListener): () => void {
  queueListeners.add(listener);
  return () => queueListeners.delete(listener);
}

function emitQueueChange(): void {
  for (const listener of [...queueListeners]) {
    try {
      listener();
    } catch (error) {
      // A misbehaving subscriber must not fail the write that notified it.
      console.warn('[db] queue listener failed', error);
    }
  }
}

// --- Queue ----------------------------------------------------------------

/**
 * Server cap on `client_request_id` (`SyncOperationItem.max_length` in the
 * backend schemas): one character over and Pydantic rejects the whole push
 * batch with a 422, so no operation in it lands.
 */
const MAX_CLIENT_REQUEST_ID = 64;

/**
 * Bound an over-long idempotency key without losing its uniqueness.
 *
 * Every caller builds ids as a fixed prefix plus a UUID, so the tail is what
 * distinguishes two records and the head is what says what kind of record it
 * is: keep 20 characters of the head and the unique tail, joined by a marker
 * a plain prefix could not collide with. Deterministic, because a retry must
 * produce the same key or the server would apply the change twice.
 */
function boundClientRequestId(raw: string): string {
  if (raw.length <= MAX_CLIENT_REQUEST_ID) return raw;
  const tail = raw.slice(-(MAX_CLIENT_REQUEST_ID - 20 - 1));
  return `${raw.slice(0, 20)}~${tail}`;
}

export async function enqueue(
  item: Omit<QueueItem, 'state' | 'attempts' | 'lastError' | 'createdAt'> &
    Partial<Pick<QueueItem, 'state' | 'attempts' | 'lastError' | 'createdAt'>>,
): Promise<void> {
  const clientRequestId = boundClientRequestId(item.clientRequestId.trim());
  if (!clientRequestId) throw new Error('enqueue requires a clientRequestId');

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sync_queue
       (client_request_id, entity, operation, record_id, version, data, state, attempts, last_error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(client_request_id) DO UPDATE SET
       entity = excluded.entity,
       operation = excluded.operation,
       record_id = excluded.record_id,
       version = excluded.version,
       data = excluded.data,
       state = 'pending',
       attempts = 0,
       last_error = NULL`,
    clientRequestId,
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
  emitQueueChange();
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

/**
 * What the next push will send: every `pending` row, oldest first.
 *
 * `failed` is deliberately not included - those rows have spent their retry
 * budget and need a human to press Retry (`retryFailedQueue`), otherwise a
 * permanently rejected operation would be resent on every sync forever. Rows
 * still marked `syncing` are excluded too: they belong to a push that is
 * either in flight right now or died with the process, and
 * `recoverStuckQueue` (run at startup) is what brings the dead ones back.
 */
export async function getPendingQueue(limit = 100): Promise<QueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM sync_queue
      WHERE state = 'pending'
      ORDER BY created_at ASC
      LIMIT ?`,
    limit,
  );
  return rows.map(rowToQueueItem);
}

/**
 * Return rows abandoned in `syncing` by a crash mid-push to `pending`.
 *
 * `syncing` means "a response is coming"; once the process is gone nothing
 * will ever report one, so those rows would sit in the outbox forever -
 * visible in the Sync Center, invisible to `getPendingQueue`, never retried.
 * Replaying them is safe: the server replays the stored result for an
 * idempotency key it has already processed instead of applying it twice.
 */
export async function recoverStuckQueue(db?: SQLite.SQLiteDatabase): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `UPDATE sync_queue SET state = 'pending', last_error = ? WHERE state = 'syncing'`,
    'recovered after an interrupted sync',
  );
  if (result.changes > 0) emitQueueChange();
  return result.changes;
}

/**
 * Put every capped row back into rotation after the user asked for a retry.
 *
 * Used by the Sync Center's Retry affordance: `attempts` restarts at zero so
 * a fix on the server side is not immediately re-capped by the old count.
 */
export async function retryFailedQueue(): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `UPDATE sync_queue SET state = 'pending', attempts = 0, last_error = NULL
      WHERE state = 'failed'`,
  );
  if (result.changes > 0) emitQueueChange();
  return result.changes;
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

/**
 * Move an outbox row between states, optionally spending one retry attempt.
 *
 * `countAttempt` is set by the engine only when the *server* answered and
 * refused the operation: a device with no signal is not the row's fault, so
 * transport failures must not march it towards the cap. The engine decides
 * between `pending` (still inside the budget, backoff handled by the network
 * layer) and `failed` (budget spent, waiting for a manual Retry) from the
 * attempt count this increments.
 */
export async function markQueueState(
  clientRequestId: string,
  state: SyncState,
  lastError?: string | null,
  options?: { countAttempt?: boolean },
): Promise<void> {
  const db = await getDatabase();
  const error = lastError ?? null;
  if (options?.countAttempt) {
    await db.runAsync(
      `UPDATE sync_queue
          SET state = ?, attempts = attempts + 1, last_error = ?
        WHERE client_request_id = ?`,
      state,
      error,
      clientRequestId,
    );
    return;
  }
  await db.runAsync(
    `UPDATE sync_queue SET state = ?, last_error = ? WHERE client_request_id = ?`,
    state,
    error,
    clientRequestId,
  );
}

export async function dequeue(clientRequestId: string): Promise<void> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'DELETE FROM sync_queue WHERE client_request_id = ?',
    clientRequestId,
  );
  if (result.changes > 0) emitQueueChange();
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
  'head_name', 'amenities', 'consent_date', 'consent_version',
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

export async function listHouseholds(): Promise<Household[]> {
  const db = await getDatabase();
  return db.getAllAsync<Household>('SELECT * FROM households ORDER BY hhid ASC');
}

export async function insertLocalBeneficiary(input: {
  id: string;
  beneficiaryId: string;
  householdId: string | null;
  abhaId?: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
  /** Captured when the exact date of birth is unknown, as in a household visit. */
  ageYears?: number | null;
  bloodGroup?: string | null;
  /** Relation to the household head (`head`, `spouse`, ...). */
  relationshipToHead?: string | null;
  /** Intake annotations mirrored into the server's beneficiaries.metadata column. */
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO beneficiaries
       (id, beneficiary_id, household_id, abha_id, full_name, gender, date_of_birth, age_years, phone, blood_group, relationship_to_head, metadata_json, status, version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?)
     ON CONFLICT(id) DO UPDATE SET
       abha_id = excluded.abha_id,
       full_name = excluded.full_name,
       gender = excluded.gender,
       date_of_birth = excluded.date_of_birth,
       age_years = excluded.age_years,
       phone = excluded.phone,
       blood_group = COALESCE(excluded.blood_group, beneficiaries.blood_group),
       relationship_to_head = COALESCE(excluded.relationship_to_head, beneficiaries.relationship_to_head),
       metadata_json = COALESCE(excluded.metadata_json, beneficiaries.metadata_json)`,
    input.id,
    input.beneficiaryId,
    input.householdId,
    input.abhaId || null,
    input.fullName,
    input.gender,
    input.dateOfBirth,
    input.ageYears ?? null,
    input.phone,
    input.bloodGroup || null,
    input.relationshipToHead || null,
    input.metadata ? JSON.stringify(input.metadata) : null,
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

/**
 * Local write for the per-member checks captured during a household visit.
 *
 * Queued with the visit itself so the device already shows what was observed
 * before the rows reach the server; the outbox carries the same payload and
 * `upsertRows` puts it back to the same place after a pull.
 */
export async function insertLocalVisitChecks(
  rows: Array<{
    id: string;
    householdId: string;
    beneficiaryId: string | null;
    checkType: string;
    result: 'ok' | 'concern';
    notes: string | null;
    visitedAt: string;
    createdBy: string | null;
    photoUrls?: string[];
  }>,
): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      await db.runAsync(
        `INSERT INTO household_visit_checks
           (id, household_id, survey_id, beneficiary_id, check_type, result, notes,
            visited_at, created_by, photo_url, created_at, updated_at, version)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           result = excluded.result,
           notes = excluded.notes,
           photo_url = excluded.photo_url,
           updated_at = excluded.updated_at`,
        row.id,
        row.householdId,
        row.beneficiaryId,
        row.checkType,
        row.result,
        row.notes,
        row.visitedAt,
        row.createdBy,
        row.photoUrls ? JSON.stringify(row.photoUrls) : null,
        now,
        now,
      );
    }
  });
}
