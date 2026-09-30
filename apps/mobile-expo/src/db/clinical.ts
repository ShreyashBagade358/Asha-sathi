import { enqueue, getDatabase } from './database';
import { TABLES, type TableName } from './tables';

/**
 * Generic pull-side writes.
 *
 * Hand-writing an INSERT/ON CONFLICT per table does not scale past a couple of
 * tables, so the statement is generated from the column registry instead. `id`
 * is the conflict target for every table.
 */

type BindValue_ = string | number | boolean | null;

function pick(record: Record<string, unknown>, columns: readonly string[]): BindValue_[] {
  return columns.map((column) => {
    const value = record[column];
    if (value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value;
    // Dates, times, uuids, json and postgres arrays all arrive as JSON scalars.
    return JSON.stringify(value);
  });
}

function quote(identifier: string): string {
  return `"${identifier}"`;
}

export async function upsertRows(table: TableName, records: Array<Record<string, unknown>>): Promise<number> {
  if (records.length === 0) return 0;
  const columns = TABLES[table];
  if (!columns.includes('id')) {
    throw new Error(`table ${table} has no id column; upsertRows requires one`);
  }

  const db = await getDatabase();
  const columnList = columns.map(quote).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const updates = columns
    .filter((column) => column !== 'id')
    .map((column) => `${quote(column)} = excluded.${quote(column)}`)
    .join(', ');

  const statement =
    `INSERT INTO ${quote(table)} (${columnList}) VALUES (${placeholders}) ` +
    `ON CONFLICT(id) DO UPDATE SET ${updates}`;

  await db.withTransactionAsync(async () => {
    for (const record of records) {
      await db.runAsync(statement, ...pick(record, columns));
    }
  });
  return records.length;
}

// --- Row shapes ------------------------------------------------------------

export type Pregnancy = {
  id: string;
  beneficiary_id: string;
  lmp: string | null;
  edd: string | null;
  gravida: number | null;
  parity: number | null;
  risk_level: string;
  anc_count: number;
  next_anc_due: string | null;
  status: string;
  updated_at: string | null;
};

export type Child = {
  id: string;
  beneficiary_id: string;
  birth_registration_no: string | null;
  birth_weight_grams: number | null;
  birth_length_cm: number | null;
  gestation_weeks: number | null;
  delivery_type: string | null;
  place_of_birth: string | null;
  created_at: string | null;
};

export type Immunization = {
  id: string;
  child_id: string;
  vaccine_code: string | null;
  vaccine_name: string | null;
  dose_number: number | null;
  due_date: string | null;
  given_date: string | null;
  status: string | null;
};

export type AshaTask = {
  id: string;
  task_date: string | null;
  task_type: string | null;
  beneficiary_id: string | null;
  household_id: string | null;
  priority: string | null;
  status: string | null;
  scheduled_time: string | null;
  completed_time: string | null;
  notes: string | null;
  /**
   * Server row version this local copy is based on. Push sends it as the
   * optimistic-concurrency token, so it must be the version that was read, not
   * a constant. `SELECT t.*` in listTasks already returns it.
   */
  version: number;
};

export type Referral = {
  id: string;
  beneficiary_id: string;
  referral_type: string | null;
  urgency: string | null;
  reason: string | null;
  clinical_summary: string | null;
  status: string | null;
  referred_to_facility_id: string | null;
  referred_to_specialist_id: string | null;
  followup_required: number | boolean | null;
  followup_date: string | null;
  initiated_at: string | null;
};

export type GrowthRecord = {
  id: string;
  child_id: string;
  record_date: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  muac_mm: number | null;
  nutrition_status: string | null;
};

export type NcdScreening = {
  id: string;
  beneficiary_id: string;
  screening_date: string | null;
  age_above_30: number | null;
  /** Server booleans; SQLite has no bool type, so these read back as 0/1. */
  tobacco_use: number | null;
  alcohol_use: number | null;
  physical_activity: number | null;
  waist_circumference_cm: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  blood_sugar_random: number | null;
  cbac_score: number | null;
  diabetes_risk: string | null;
  hypertension_risk: string | null;
  cardiovascular_risk: string | null;
  cancer_risk: string | null;
  referral_made: number | null;
  referral_type: string | null;
  referral_facility_id: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type AncVisit = {
  id: string;
  pregnancy_id: string;
  visit_number: number | null;
  visit_date: string | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  weight_kg: number | null;
  hemoglobin: number | null;
  danger_signs: string | null;
};

export type RiskLevel = 'high' | 'medium' | 'low';

export type PatientRow = {
  id: string;
  beneficiary_id: string | null;
  full_name: string;
  gender: string | null;
  age_years: number | null;
  age_months: number | null;
  phone: string | null;
  household_id: string | null;
  /** Denormalised from the households join so list rows can show the HHID. */
  household_hhid: string | null;
  status: string | null;
  /** Derived from pregnancies / NCD screenings, since the server has no risk column on beneficiaries. */
  risk: RiskLevel;
  risk_reason: string | null;
};

function riskRank(level: RiskLevel): number {
  return level === 'high' ? 3 : level === 'medium' ? 2 : 1;
}

/**
 * The server stores risk where it is clinically relevant (pregnancies.risk_level,
 * ncd_screenings.*_risk) rather than on the beneficiary row, so the patient list
 * derives it the same way the dashboard's high-risk count does. A beneficiary with
 * no pregnancy or screening defaults to low, matching the web's mock default.
 *
 * SQL returns a severity integer (0 low / 1 medium / 2 high) rather than a label.
 * Mapping the label here rather than in SQL keeps this a single flat aggregate
 * instead of a correlated CASE over an aggregate, which SQLite rejects.
 */
const RISK_SQL = `
  SELECT b.*,
    h.hhid AS household_hhid,
    COALESCE((
      SELECT CASE LOWER(COALESCE(pr.risk_level, 'low'))
               WHEN 'high' THEN 2
               WHEN 'high_risk' THEN 2
               WHEN 'medium' THEN 1
               WHEN 'moderate' THEN 1
               ELSE 0 END
      FROM pregnancies pr
      WHERE pr.beneficiary_id = b.id
        AND COALESCE(pr.status, 'active') NOT IN ('delivered', 'aborted', 'closed')
      ORDER BY CASE LOWER(COALESCE(pr.risk_level, 'low'))
                 WHEN 'high' THEN 0 WHEN 'high_risk' THEN 0
                 WHEN 'medium' THEN 1 WHEN 'moderate' THEN 1
                 ELSE 2 END
      LIMIT 1
    ), (
      SELECT MAX(
        CASE
          WHEN LOWER(COALESCE(n.diabetes_risk, '')) IN ('high', 'yes', 'true')
            OR LOWER(COALESCE(n.hypertension_risk, '')) IN ('high', 'yes', 'true') THEN 2
          WHEN LOWER(COALESCE(n.diabetes_risk, '')) IN ('medium', 'moderate')
            OR LOWER(COALESCE(n.hypertension_risk, '')) IN ('medium', 'moderate') THEN 1
          ELSE 0
        END)
      FROM ncd_screenings n
      WHERE n.beneficiary_id = b.id
    ), 0) AS risk_score
  FROM beneficiaries b
  LEFT JOIN households h ON h.id = b.household_id
`;

const RISK_BY_SCORE: Record<number, RiskLevel> = { 0: 'low', 1: 'medium', 2: 'high' };

// --- Queries ---------------------------------------------------------------

export async function listPatients(options: { search?: string; risk?: RiskLevel | 'all' } = {}): Promise<PatientRow[]> {
  const db = await getDatabase();
  const where: string[] = [];
  const params: BindValue_[] = [];

  const search = options.search?.trim();
  if (search) {
    where.push('(b.full_name LIKE ? OR b.beneficiary_id LIKE ? OR b.phone LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  let sql = RISK_SQL;
  if (where.length) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }
  sql += ' ORDER BY b.full_name ASC';

  const rows = await db.getAllAsync<Record<string, unknown>>(sql, ...params);
  const patients = rows.map(toPatientRow);

  if (!options.risk || options.risk === 'all') {
    return patients;
  }
  return patients.filter((p) => p.risk === options.risk);
}

export async function getPatient(id: string): Promise<PatientRow | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(`${RISK_SQL} WHERE b.id = ?`, id);
  return row ? toPatientRow(row) : null;
}

function toPatientRow(row: Record<string, unknown>): PatientRow {
  return {
    id: String(row.id),
    beneficiary_id: row.beneficiary_id === null ? null : String(row.beneficiary_id),
    full_name: String(row.full_name ?? ''),
    gender: row.gender === null ? null : String(row.gender),
    age_years: row.age_years === null ? null : Number(row.age_years),
    age_months: row.age_months === null ? null : Number(row.age_months),
    phone: row.phone === null ? null : String(row.phone),
    household_id: row.household_id === null ? null : String(row.household_id),
    household_hhid: row.household_hhid === null || row.household_hhid === undefined ? null : String(row.household_hhid),
    status: row.status === null ? null : String(row.status),
    risk: RISK_BY_SCORE[Number(row.risk_score ?? 0)] ?? 'low',
    risk_reason: row.risk_reason === null ? null : String(row.risk_reason),
  };
}

export async function listPregnancies(beneficiaryId?: string): Promise<Pregnancy[]> {
  const db = await getDatabase();
  if (beneficiaryId) {
    return db.getAllAsync<Pregnancy>(
      `SELECT * FROM pregnancies WHERE beneficiary_id = ? ORDER BY edd DESC`,
      beneficiaryId,
    );
  }
  return db.getAllAsync<Pregnancy>('SELECT * FROM pregnancies ORDER BY next_anc_due ASC');
}

export async function listChildren(beneficiaryId?: string): Promise<Child[]> {
  const db = await getDatabase();
  if (beneficiaryId) {
    return db.getAllAsync<Child>('SELECT * FROM children WHERE beneficiary_id = ? ORDER BY created_at DESC', beneficiaryId);
  }
  return db.getAllAsync<Child>('SELECT * FROM children ORDER BY created_at DESC');
}

export async function listAncVisits(pregnancyId: string): Promise<AncVisit[]> {
  const db = await getDatabase();
  return db.getAllAsync<AncVisit>('SELECT * FROM anc_visits WHERE pregnancy_id = ? ORDER BY visit_number ASC', pregnancyId);
}

export async function listImmunizations(childId?: string): Promise<Immunization[]> {
  const db = await getDatabase();
  if (childId) {
    return db.getAllAsync<Immunization>('SELECT * FROM immunizations WHERE child_id = ? ORDER BY due_date ASC', childId);
  }
  return db.getAllAsync<Immunization>('SELECT * FROM immunizations ORDER BY due_date ASC');
}

export async function listGrowthRecords(childId?: string): Promise<GrowthRecord[]> {
  const db = await getDatabase();
  if (childId) {
    return db.getAllAsync<GrowthRecord>('SELECT * FROM growth_records WHERE child_id = ? ORDER BY record_date ASC', childId);
  }
  return db.getAllAsync<GrowthRecord>('SELECT * FROM growth_records ORDER BY record_date ASC');
}

export async function listNcdScreenings(beneficiaryId?: string): Promise<NcdScreening[]> {
  const db = await getDatabase();
  if (beneficiaryId) {
    return db.getAllAsync<NcdScreening>('SELECT * FROM ncd_screenings WHERE beneficiary_id = ? ORDER BY screening_date DESC', beneficiaryId);
  }
  return db.getAllAsync<NcdScreening>('SELECT * FROM ncd_screenings ORDER BY screening_date DESC');
}

export async function listReferrals(beneficiaryId?: string): Promise<Referral[]> {
  const db = await getDatabase();
  if (beneficiaryId) {
    return db.getAllAsync<Referral>('SELECT * FROM referrals WHERE beneficiary_id = ? ORDER BY initiated_at DESC', beneficiaryId);
  }
  return db.getAllAsync<Referral>('SELECT * FROM referrals ORDER BY initiated_at DESC');
}

// --- Module list screens -------------------------------------------------
//
// The More-menu modules (pregnancy, child health, referrals) each render a list
// of records with the subject's name on the row. The per-patient queries above
// keep their plain shape because the patient detail tabs already join those
// names in JS; these variants do the join in SQL instead, so a module screen is
// one query rather than a list plus a lookup map.

export type PregnancyWithPatient = Pregnancy & { patient_name: string | null; household_hhid: string | null };

export async function listPregnanciesWithPatient(): Promise<PregnancyWithPatient[]> {
  const db = await getDatabase();
  return db.getAllAsync<PregnancyWithPatient>(
    `SELECT p.*, b.full_name AS patient_name, h.hhid AS household_hhid
       FROM pregnancies p
       LEFT JOIN beneficiaries b ON b.id = p.beneficiary_id
       LEFT JOIN households h ON h.id = b.household_id
      ORDER BY p.next_anc_due IS NULL, p.next_anc_due ASC`,
  );
}

export type ChildWithParent = Child & { patient_name: string | null; household_hhid: string | null };

export async function listChildrenWithParent(): Promise<ChildWithParent[]> {
  const db = await getDatabase();
  return db.getAllAsync<ChildWithParent>(
    `SELECT c.*, b.full_name AS patient_name, h.hhid AS household_hhid
       FROM children c
       LEFT JOIN beneficiaries b ON b.id = c.beneficiary_id
       LEFT JOIN households h ON h.id = b.household_id
      ORDER BY c.created_at DESC`,
  );
}

export type ReferralWithPatient = Referral & { patient_name: string | null };

export async function listReferralsWithPatient(): Promise<ReferralWithPatient[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReferralWithPatient>(
    `SELECT r.*, b.full_name AS patient_name
       FROM referrals r
       LEFT JOIN beneficiaries b ON b.id = r.beneficiary_id
      ORDER BY r.initiated_at DESC`,
  );
}

export type TaskFilter = 'pending' | 'done' | 'all';

export type TaskWithPatient = AshaTask & { patient_name: string | null; household_hhid: string | null };

/** Tasks joined to their subject, which is what every task list row renders. */
export async function listTasks(filter: TaskFilter = 'all'): Promise<TaskWithPatient[]> {
  const db = await getDatabase();
  const where =
    filter === 'pending'
      ? `WHERE t.status IS NULL OR t.status NOT IN ('completed', 'done', 'cancelled')`
      : filter === 'done'
        ? `WHERE t.status IN ('completed', 'done')`
        : '';

  return db.getAllAsync<TaskWithPatient>(
    `SELECT t.*, b.full_name AS patient_name, h.hhid AS household_hhid
       FROM asha_tasks t
       LEFT JOIN beneficiaries b ON b.id = t.beneficiary_id
       LEFT JOIN households h ON h.id = t.household_id
       ${where}
       ORDER BY
         CASE WHEN t.status IN ('completed','done') THEN 1 ELSE 0 END,
         COALESCE(t.scheduled_time, t.task_date) ASC`,
  );
}

/**
 * Mark a task done/pending.
 *
 * Writes the local row and the sync outbox in one transaction so a task can
 * never be toggled on screen yet silently lost before the next push. The row
 * that goes on the wire is the whole current record, which is what the backend
 * push endpoint expects for an `update`.
 */
export async function setTaskStatus(task: AshaTask, done: boolean): Promise<void> {
  const db = await getDatabase();
  const status = done ? 'completed' : 'pending';
  const completedTime = done ? new Date().toISOString() : null;
  // `version` is the concurrency token, not a record column: the backend pops
  // it from the payload and uses it only to detect a stale edit.
  const { version, ...fields } = task;

  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE asha_tasks SET status = ?, completed_time = ? WHERE id = ?`, status, completedTime, task.id);
    await enqueue({
      clientRequestId: `update-task-${task.id}`,
      entity: 'asha_tasks',
      operation: 'update',
      recordId: task.id,
      // Must be the version this edit was based on. The server rejects the
      // write when it is behind (`stale_version` in sync_service.py), so a
      // hardcoded 1 would make every toggle after the first one conflict.
      version,
      data: { ...fields, status, completed_time: completedTime },
    });
  });
}

export type HouseholdWithCounts = {
  id: string;
  hhid: string | null;
  address: string | null;
  village_id: string | null;
  members: number;
  open_tasks: number;
  /** Earliest outstanding task date, so the card can be visit-due vs scheduled. */
  next_task_date: string | null;
};

export async function listHouseholdsWithCounts(): Promise<HouseholdWithCounts[]> {
  const db = await getDatabase();
  return db.getAllAsync<HouseholdWithCounts>(
    `SELECT h.id, h.hhid, h.address, h.village_id,
            (SELECT COUNT(*) FROM beneficiaries b WHERE b.household_id = h.id) AS members,
            (SELECT COUNT(*) FROM asha_tasks t
              WHERE t.household_id = h.id
                AND (t.status IS NULL OR t.status NOT IN ('completed','done','cancelled'))) AS open_tasks,
            (SELECT MIN(COALESCE(t.task_date, '')) FROM asha_tasks t
              WHERE t.household_id = h.id
                AND (t.status IS NULL OR t.status NOT IN ('completed','done','cancelled'))) AS next_task_date
       FROM households h
       ORDER BY h.hhid ASC`,
  );
}

export type DashboardKpis = {
  todayAgenda: number;
  pendingTasks: number;
  households: number;
  highRisk: number;
};

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const db = await getDatabase();
  const today = new Date().toISOString().slice(0, 10);

  const scalar = async (sql: string, ...params: BindValue_[]) => {
    const row = await db.getFirstAsync<{ value: number }>(sql, ...params);
    return Number(row?.value ?? 0);
  };

  const [todayAgenda, pendingTasks, households, highRisk] = await Promise.all([
    scalar(
      `SELECT COUNT(*) AS value FROM asha_tasks
        WHERE COALESCE(task_date, '') <= ?
          AND (status IS NULL OR status NOT IN ('completed','done','cancelled'))`,
      today,
    ),
    scalar(
      `SELECT COUNT(*) AS value FROM asha_tasks
        WHERE status IS NULL OR status NOT IN ('completed','done','cancelled')`,
    ),
    scalar('SELECT COUNT(*) AS value FROM households'),
    scalar(
      `SELECT COUNT(DISTINCT beneficiary_id) AS value FROM pregnancies
        WHERE LOWER(risk_level) IN ('high','high_risk')
          AND (status IS NULL OR status NOT IN ('delivered','aborted','closed'))`,
    ),
  ]);

  return { todayAgenda, pendingTasks, households, highRisk };
}

export type HouseholdMember = {
  id: string;
  full_name: string;
  gender: string | null;
  age_years: number | null;
  age_months: number | null;
  /** True when this member is the patient whose detail screen is open. */
  isSubject: boolean;
};

/** Co-members of a household, so the detail page's member list is real. */
export async function listHouseholdMembers(householdId: string, subjectId: string): Promise<HouseholdMember[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT id, full_name, gender, age_years, age_months
       FROM beneficiaries
      WHERE household_id = ?
      ORDER BY age_years DESC, full_name ASC`,
    householdId,
  );
  return rows.map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name ?? ''),
    gender: row.gender === null ? null : String(row.gender),
    age_years: row.age_years === null ? null : Number(row.age_years),
    age_months: row.age_months === null ? null : Number(row.age_months),
    isSubject: String(row.id) === subjectId,
  }));
}

export async function getHouseholdAddress(householdId: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ address: string | null }>('SELECT address FROM households WHERE id = ?', householdId);
  return row?.address ?? null;
}

export async function countRows(table: TableName): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${quote(table)}`);
  return Number(row?.count ?? 0);
}

// --- Programme modules -----------------------------------------------------
//
// Queries for the four More-menu modules. Each one joins the row to the
// beneficiary so a screen can show a person rather than a bare UUID, which is
// what the web's mock arrays did.

// --- Health checkup (NCD screening) ----------------------------------------

export type HealthCheckup = NcdScreening & {
  patient_name: string | null;
  age_years: number | null;
  age_months: number | null;
  household_hhid: string | null;
};

/** Risk band for a screening, worst-first, so a chip can colour the row. */
export function checkupRiskLevel(row: {
  diabetes_risk: string | null;
  hypertension_risk: string | null;
  cardiovascular_risk: string | null;
  cancer_risk: string | null;
}): RiskLevel {
  const rank = (value: string | null) => {
    const v = String(value ?? '').toLowerCase();
    if (v === 'high' || v === 'yes' || v === 'true') return 2;
    if (v === 'medium' || v === 'moderate' || v === 'borderline') return 1;
    return 0;
  };
  const worst = Math.max(
    rank(row.diabetes_risk),
    rank(row.hypertension_risk),
    rank(row.cardiovascular_risk),
    rank(row.cancer_risk),
  );
  return worst === 2 ? 'high' : worst === 1 ? 'medium' : 'low';
}

export async function listHealthCheckups(): Promise<HealthCheckup[]> {
  const db = await getDatabase();
  return db.getAllAsync<HealthCheckup>(
    `SELECT n.*, b.full_name AS patient_name, b.age_years, b.age_months,
            h.hhid AS household_hhid
       FROM ncd_screenings n
       LEFT JOIN beneficiaries b ON b.id = n.beneficiary_id
       LEFT JOIN households h ON h.id = b.household_id
      ORDER BY COALESCE(n.screening_date, n.created_at) DESC`,
  );
}

// --- Follow-ups ------------------------------------------------------------

export type FollowUp = {
  id: string;
  kind: 'referral' | 'task';
  patient_name: string | null;
  household_hhid: string | null;
  title: string;
  detail: string | null;
  due_date: string | null;
  urgency: string | null;
  status: string | null;
};

/**
 * Everything the ASHA has promised to come back for, newest deadline first.
 *
 * Two sources, because a follow-up is either a promise made to a patient
 * (referral.followup_date) or a task on the worker's own list; leaving either
 * out would let a due visit fall through.
 */
export async function listFollowUps(): Promise<FollowUp[]> {
  const db = await getDatabase();
  const referrals = await db.getAllAsync<{
    id: string;
    patient_name: string | null;
    household_hhid: string | null;
    referral_type: string | null;
    reason: string | null;
    followup_date: string | null;
    urgency: string | null;
    status: string | null;
  }>(
    `SELECT r.id, b.full_name AS patient_name, h.hhid AS household_hhid,
            r.referral_type, r.reason, r.followup_date, r.urgency, r.status
       FROM referrals r
       LEFT JOIN beneficiaries b ON b.id = r.beneficiary_id
       LEFT JOIN households h ON h.id = b.household_id
      WHERE r.followup_required = 1
        AND COALESCE(r.status, '') NOT IN ('completed', 'cancelled')
      ORDER BY r.followup_date ASC`,
  );

  const tasks = await db.getAllAsync<{
    id: string;
    patient_name: string | null;
    household_hhid: string | null;
    task_type: string | null;
    notes: string | null;
    task_date: string | null;
    priority: string | null;
    status: string | null;
  }>(
    `SELECT t.id, b.full_name AS patient_name, h.hhid AS household_hhid,
            t.task_type, t.notes, t.task_date, t.priority, t.status
       FROM asha_tasks t
       LEFT JOIN beneficiaries b ON b.id = t.beneficiary_id
       LEFT JOIN households h ON h.id = t.household_id
      WHERE COALESCE(t.status, '') NOT IN ('completed', 'cancelled')
      ORDER BY t.task_date ASC`,
  );

  const rows: FollowUp[] = [
    ...referrals.map((r) => ({
      id: `referral:${r.id}`,
      kind: 'referral' as const,
      patient_name: r.patient_name,
      household_hhid: r.household_hhid,
      title: r.referral_type ?? '',
      detail: r.reason,
      due_date: r.followup_date,
      urgency: r.urgency,
      status: r.status,
    })),
    ...tasks.map((t) => ({
      id: `task:${t.id}`,
      kind: 'task' as const,
      patient_name: t.patient_name,
      household_hhid: t.household_hhid,
      title: t.task_type ?? '',
      detail: t.notes,
      due_date: t.task_date,
      urgency: t.priority,
      status: t.status,
    })),
  ];

  // A NULL due date sorts last rather than first, and ties fall back to the
  // urgency the server gave the row.
  return rows.sort((a, b) => {
    const left = a.due_date ?? '9999-12-31';
    const right = b.due_date ?? '9999-12-31';
    if (left !== right) return left < right ? -1 : 1;
    return String(a.urgency ?? '').localeCompare(String(b.urgency ?? ''));
  });
}

// --- Notifications ---------------------------------------------------------

export type AppNotification = {
  id: string;
  kind: 'overdue' | 'due' | 'referral' | 'immunization';
  title: string;
  body: string | null;
  date: string | null;
  severity: 'high' | 'medium' | 'low';
};

/**
 * Notifications are derived from the synced tables rather than read from a
 * server notifications feed: the backend does not put `notifications` in its
 * sync registry, so there is nothing to pull. Deriving them means an alert
 * still appears with no network, which is the whole point for an ASHA working
 * in a village with no signal.
 */
export async function buildNotifications(): Promise<AppNotification[]> {
  const db = await getDatabase();
  const today = new Date().toISOString().slice(0, 10);

  const overdue = await db.getAllAsync<{ id: string; task_type: string | null; task_date: string | null; patient_name: string | null }>(
    `SELECT t.id, t.task_type, t.task_date, b.full_name AS patient_name
       FROM asha_tasks t
       LEFT JOIN beneficiaries b ON b.id = t.beneficiary_id
      WHERE COALESCE(t.status, '') NOT IN ('completed', 'cancelled')
        AND t.task_date IS NOT NULL
        AND t.task_date < ?
      ORDER BY t.task_date ASC`,
    today,
  );

  const dueToday = await db.getAllAsync<{ id: string; task_type: string | null; patient_name: string | null }>(
    `SELECT t.id, t.task_type, b.full_name AS patient_name
       FROM asha_tasks t
       LEFT JOIN beneficiaries b ON b.id = t.beneficiary_id
      WHERE COALESCE(t.status, '') NOT IN ('completed', 'cancelled')
        AND t.task_date = ?`,
    today,
  );

  const referrals = await db.getAllAsync<{ id: string; referral_type: string | null; urgency: string | null; patient_name: string | null; followup_date: string | null }>(
    `SELECT r.id, r.referral_type, r.urgency, r.followup_date, b.full_name AS patient_name
       FROM referrals r
       LEFT JOIN beneficiaries b ON b.id = r.beneficiary_id
      WHERE r.followup_required = 1
        AND COALESCE(r.status, '') NOT IN ('completed', 'cancelled')
        AND (r.followup_date IS NULL OR r.followup_date <= ?)
      ORDER BY r.followup_date ASC`,
    today,
  );

  const immunizations = await db.getAllAsync<{ id: string; vaccine_name: string | null; due_date: string | null; patient_name: string | null }>(
    `SELECT i.id, i.vaccine_name, i.due_date, b.full_name AS patient_name
       FROM immunizations i
       LEFT JOIN children c ON c.id = i.child_id
       LEFT JOIN beneficiaries b ON b.id = c.beneficiary_id
      WHERE LOWER(COALESCE(i.status, '')) IN ('due', 'pending')
        AND i.due_date IS NOT NULL
        AND i.due_date <= ?
      ORDER BY i.due_date ASC`,
    today,
  );

  return [
    ...overdue.map((r) => ({
      id: `overdue:${r.id}`,
      kind: 'overdue' as const,
      title: r.task_type ?? '',
      body: r.patient_name,
      date: r.task_date,
      severity: 'high' as const,
    })),
    ...dueToday.map((r) => ({
      id: `due:${r.id}`,
      kind: 'due' as const,
      title: r.task_type ?? '',
      body: r.patient_name,
      date: today,
      severity: 'medium' as const,
    })),
    ...referrals.map((r) => ({
      id: `referral:${r.id}`,
      kind: 'referral' as const,
      title: r.referral_type ?? '',
      body: r.patient_name,
      date: r.followup_date,
      severity: String(r.urgency ?? '').toLowerCase() === 'urgent' ? ('high' as const) : ('medium' as const),
    })),
    ...immunizations.map((r) => ({
      id: `immunization:${r.id}`,
      kind: 'immunization' as const,
      title: r.vaccine_name ?? '',
      body: r.patient_name,
      date: r.due_date,
      severity: 'low' as const,
    })),
  ];
}

// --- Village / household health survey --------------------------------------

export type VillageForm = {
  id: string;
  form_type: string;
  form_date: string | null;
  status: string | null;
  form_data: string | null;
  incentive_eligible: number | null;
  incentive_amount: number | null;
  submitted_at: string | null;
};

export async function listVillageForms(formType?: string): Promise<VillageForm[]> {
  const db = await getDatabase();
  if (formType) {
    return db.getAllAsync<VillageForm>(
      `SELECT * FROM village_forms WHERE form_type = ? ORDER BY COALESCE(form_date, created_at) DESC`,
      formType,
    );
  }
  return db.getAllAsync<VillageForm>(
    `SELECT * FROM village_forms ORDER BY COALESCE(form_date, created_at) DESC`,
  );
}

/**
 * Survey answers vary by form type, so they are read defensively: a form
 * captured by an older build of the app may be missing keys this build expects.
 */
export function readFormData(form: VillageForm): Record<string, unknown> {
  if (!form.form_data) return {};
  try {
    const parsed: unknown = JSON.parse(form.form_data);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
