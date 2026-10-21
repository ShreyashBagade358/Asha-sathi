import { todayIso } from '../utils/date';
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
    for (const raw of records) {
      // The server serialises the JSON column as `metadata_json`, but the
      // local asha_tasks column is `metadata`. Without this alias the pulled
      // value lands on `undefined` and is stored as null.
      const record =
        raw['metadata'] === undefined && raw['metadata_json'] !== undefined
          ? { ...raw, metadata: raw['metadata_json'] }
          : raw;
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
  mother_id: string | null;
  father_id: string | null;
  delivery_outcome_id: string | null;
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
  abha_id: string | null;
  full_name: string;
  gender: string | null;
  /** `b.*` already carries these; only the display rows (child form meta) need them. */
  date_of_birth: string | null;
  age_years: number | null;
  age_months: number | null;
  phone: string | null;
  household_id: string | null;
  /** Denormalised from the households join so list rows can show the HHID. */
  household_hhid: string | null;
  status: string | null;
  blood_group: string | null;
  photo_url: string | null;
  /**
   * Higher of the clinically derived level (pregnancies / NCD screenings) and
   * the intake assessment stored in beneficiaries.metadata_json.risk, so a
   * patient flagged urgent at registration shows as high risk immediately.
   */
  risk: RiskLevel;
  risk_reason: string | null;
  updated_at: string | null;
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
    ), 0) AS risk_score,
    COALESCE((
      SELECT CASE LOWER(COALESCE(pr.risk_level, 'low'))
               WHEN 'high' THEN 'High-risk pregnancy'
               WHEN 'high_risk' THEN 'High-risk pregnancy'
               WHEN 'medium' THEN 'Moderate-risk pregnancy'
               WHEN 'moderate' THEN 'Moderate-risk pregnancy'
             END
      FROM pregnancies pr
      WHERE pr.beneficiary_id = b.id
        AND COALESCE(pr.status, 'active') NOT IN ('delivered', 'aborted', 'closed')
      ORDER BY CASE LOWER(COALESCE(pr.risk_level, 'low'))
                 WHEN 'high' THEN 0 WHEN 'high_risk' THEN 0
                 WHEN 'medium' THEN 1 WHEN 'moderate' THEN 1
                 ELSE 2 END
      LIMIT 1
    ), (
      SELECT CASE WHEN MAX(
        CASE
          WHEN LOWER(COALESCE(n.diabetes_risk, '')) IN ('high', 'yes', 'true')
            OR LOWER(COALESCE(n.hypertension_risk, '')) IN ('high', 'yes', 'true') THEN 2
          WHEN LOWER(COALESCE(n.diabetes_risk, '')) IN ('medium', 'moderate')
            OR LOWER(COALESCE(n.hypertension_risk, '')) IN ('medium', 'moderate') THEN 1
          ELSE 0
        END) >= 1 THEN 'NCD screening' END
      FROM ncd_screenings n
      WHERE n.beneficiary_id = b.id
    )) AS risk_reason
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
  const metadata = parseMetadata(row.metadata_json);
  const derivedRisk = RISK_BY_SCORE[Number(row.risk_score ?? 0)] ?? 'low';
  const intakeRisk = normalizeRisk(metadata?.risk);
  const risk = riskRank(intakeRisk) > riskRank(derivedRisk) ? intakeRisk : derivedRisk;
  const derivedReason =
    // `risk_reason` is an alias, not a column, so an unselected row reports
    // `undefined` rather than `null`; `==` catches both before String() would
    // turn a missing value into the literal text "undefined".
    row.risk_reason == null ? null : String(row.risk_reason);
  return {
    id: String(row.id),
    beneficiary_id: row.beneficiary_id === null || row.beneficiary_id === undefined ? null : String(row.beneficiary_id),
    abha_id: row.abha_id === null || row.abha_id === undefined ? null : String(row.abha_id),
    full_name: String(row.full_name ?? ''),
    gender: row.gender === null ? null : String(row.gender),
    date_of_birth: row.date_of_birth == null ? null : String(row.date_of_birth),
    age_years: row.age_years === null ? null : Number(row.age_years),
    age_months: row.age_months === null ? null : Number(row.age_months),
    phone: row.phone === null ? null : String(row.phone),
    household_id: row.household_id === null ? null : String(row.household_id),
    household_hhid: row.household_hhid === null || row.household_hhid === undefined ? null : String(row.household_hhid),
    status: row.status === null ? null : String(row.status),
    blood_group: row.blood_group == null ? null : String(row.blood_group),
    photo_url: row.photo_url == null ? null : String(row.photo_url),
    risk,
    risk_reason: derivedReason ?? (risk === intakeRisk && intakeRisk !== 'low' ? 'Flagged at intake' : null),
    updated_at: row.updated_at == null ? null : String(row.updated_at),
  };
}

/**
 * Search local beneficiaries by name / mobile / ABHA ID — the "search
 * existing" half of the link-member flow. Offline by design: everything
 * synced down lives in SQLite, so the field lookup needs no signal.
 */
export async function searchBeneficiariesLocal(
  term: string,
  opts: { excludeHouseholdId?: string; limit?: number } = {},
): Promise<PatientRow[]> {
  const db = await getDatabase();
  const like = `%${term.trim()}%`;
  const exclude = opts.excludeHouseholdId ?? '';
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM beneficiaries
      WHERE COALESCE(status, 'active') != 'inactive'
        AND (full_name LIKE ? OR phone LIKE ? OR abha_id LIKE ?)
        AND COALESCE(household_id, '') != ?
      ORDER BY full_name
      LIMIT ?`,
    like,
    like,
    like,
    exclude,
    opts.limit ?? 8,
  );
  return rows.map(toPatientRow);
}

/**
 * Link an existing beneficiary into a household. Offline-first like every
 * other write: the local row's household_id flips now and an `update`
 * rides the outbox, so the link lands on the server after the next push.
 */
export async function updateBeneficiaryHouseholdLocal(
  beneficiaryId: string,
  householdId: string,
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ version: number | null }>(
      'SELECT version FROM beneficiaries WHERE id = ?',
      beneficiaryId,
    );
    const now = new Date().toISOString();
    await db.runAsync(
      'UPDATE beneficiaries SET household_id = ?, updated_at = ? WHERE id = ?',
      householdId,
      now,
      beneficiaryId,
    );
    await enqueue({
      clientRequestId: `link-beneficiary-${beneficiaryId}`,
      entity: 'beneficiaries',
      operation: 'update',
      recordId: beneficiaryId,
      version: row?.version ?? 1,
      data: { id: beneficiaryId, household_id: householdId, updated_at: now },
    });
  });
}

/** beneficiaries.metadata_json is stored as text; ignore anything unparseable. */
function parseMetadata(value: unknown): { risk?: unknown } | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as { risk?: unknown }) : null;
  } catch {
    return null;
  }
}

function normalizeRisk(value: unknown): RiskLevel {
  const v = String(value ?? '').toLowerCase();
  if (v === 'high' || v === 'high_risk') return 'high';
  if (v === 'medium' || v === 'moderate') return 'medium';
  return 'low';
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

export type ImmunizationDetail = Immunization & {
  batch_number: string | null;
  site: string | null;
  /** Optimistic-concurrency token; see AshaTask.version. */
  version: number;
};

export async function listImmunizationDetails(childId: string): Promise<ImmunizationDetail[]> {
  const db = await getDatabase();
  return db.getAllAsync<ImmunizationDetail>(
    'SELECT * FROM immunizations WHERE child_id = ? ORDER BY due_date ASC',
    childId,
  );
}

/**
 * Record a dose as given.
 *
 * Same offline-first contract as setTaskStatus: the local row and the outbox
 * copy are written in one transaction, so a dose marked in a village with no
 * signal still reaches the server on the next push.
 */
export async function markImmunizationGiven(row: ImmunizationDetail, givenDate: string): Promise<void> {
  const db = await getDatabase();
  const { version, ...fields } = row;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE immunizations SET status = ?, given_date = ? WHERE id = ?',
      'given',
      givenDate,
      row.id,
    );
    await enqueue({
      clientRequestId: `update-immunization-${row.id}`,
      entity: 'immunizations',
      operation: 'update',
      recordId: row.id,
      version,
      data: { ...fields, status: 'given', given_date: givenDate },
    });
  });
}

export type VaccinationSummary = {
  total: number;
  given: number;
  due: number;
  overdue: number;
  next_due: { vaccine_name: string | null; dose_number: number | null; due_date: string } | null;
};

/**
 * Roll a child's immunization rows into the counts the Child Health list shows.
 *
 * The per-dose status is re-derived from the due date rather than trusted from
 * the stored `status` column, because a row left as `due` after its day passes
 * is overdue in the field even though the server never sent an update — the
 * same rule deriveDoseStatus applies on the schedule screen. `next_due` is the
 * earliest dose that is still outstanding, whether it is due now or late.
 */
export async function getVaccinationSummary(childId: string): Promise<VaccinationSummary> {
  const rows = await listImmunizations(childId);
  const today = todayIso();
  let given = 0;
  let due = 0;
  let overdue = 0;
  let nextDue: VaccinationSummary['next_due'] = null;
  for (const row of rows) {
    const dueDay = row.due_date == null ? null : row.due_date.slice(0, 10);
    const effective =
      row.status === 'given' || row.given_date
        ? 'given'
        : row.status === 'overdue' || (row.status === 'due' && dueDay != null && dueDay < today)
          ? 'overdue'
          : row.status === 'skipped'
            ? 'skipped'
            : 'due';
    if (effective === 'given') given++;
    else if (effective === 'overdue') overdue++;
    else if (effective === 'due') due++;
    if (effective !== 'given' && row.due_date != null && dueDay != null) {
      if (!nextDue || dueDay < nextDue.due_date.slice(0, 10)) {
        nextDue = {
          vaccine_name: row.vaccine_name ?? row.vaccine_code,
          dose_number: row.dose_number,
          due_date: row.due_date,
        };
      }
    }
  }
  return { total: rows.length, given, due, overdue, next_due: nextDue };
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

/**
 * `id` is null while the child exists only as a locally registered
 * beneficiary: registration writes `beneficiaries`, never `children`.
 */
export type ChildWithParent = Omit<Child, 'id'> & {
  id: string | null;
  patient_name: string | null;
  household_hhid: string | null;
};

/**
 * Child-aged beneficiaries for the Child Health list, joined to their child
 * record and household.
 *
 * Driving this off `children` alone hid every locally registered child, since
 * register only inserts into `beneficiaries`. The age test is the household
 * card's under-5 counter with a date-of-birth fallback, because a locally
 * registered row carries a DOB and no age columns until the server pull lands.
 */
export async function listChildrenWithParent(): Promise<ChildWithParent[]> {
  const db = await getDatabase();
  return db.getAllAsync<ChildWithParent>(
    `SELECT c.id, b.id AS beneficiary_id, c.birth_registration_no, c.birth_weight_grams,
            c.birth_length_cm, c.gestation_weeks, c.delivery_type, c.place_of_birth, c.created_at,
            b.full_name AS patient_name, h.hhid AS household_hhid
       FROM beneficiaries b
       LEFT JOIN children c ON c.beneficiary_id = b.id
       LEFT JOIN households h ON h.id = b.household_id
      WHERE (b.age_years IS NOT NULL AND b.age_years < 5)
         OR (b.age_years IS NULL AND b.age_months IS NOT NULL AND b.age_months < 60)
         OR (b.age_years IS NULL AND b.age_months IS NULL AND b.date_of_birth IS NOT NULL
             AND date('now') < date(b.date_of_birth, '+5 years'))
      ORDER BY COALESCE(c.created_at, b.updated_at) DESC`,
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

export type ReferralFollowupRow = {
  id: string;
  referral_id: string;
  followup_date: string | null;
  conducted_by: string | null;
  beneficiary_status: string | null;
  treatment_compliance: string | null;
  notes: string | null;
  created_at: string;
};

/** Follow-ups recorded for one referral, newest due date first. */
export async function listReferralFollowups(referralId: string): Promise<ReferralFollowupRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReferralFollowupRow>(
    `SELECT id, referral_id, followup_date, conducted_by, beneficiary_status,
            treatment_compliance, notes, created_at
       FROM referral_followups
      WHERE referral_id = ?
      ORDER BY COALESCE(followup_date, '') DESC`,
    referralId,
  );
}

/** Local commit for a referral follow-up recorded in the field (offline-first). */
export async function insertLocalReferralFollowup(input: {
  id: string;
  referralId: string;
  followupDate: string;
  conductedBy: string | null;
  beneficiaryStatus: string | null;
  treatmentCompliance: string | null;
  notes: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO referral_followups
       (id, referral_id, followup_date, conducted_by, beneficiary_status,
        treatment_compliance, complications, further_referral, notes,
        created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, 1)
     ON CONFLICT(id) DO UPDATE SET
       followup_date = excluded.followup_date,
       beneficiary_status = excluded.beneficiary_status,
       treatment_compliance = excluded.treatment_compliance,
       notes = excluded.notes,
       updated_at = excluded.updated_at`,
    input.id,
    input.referralId,
    input.followupDate,
    input.conductedBy,
    input.beneficiaryStatus,
    input.treatmentCompliance,
    input.notes,
    now,
    now,
  );
}

export type TaskFilter = 'pending' | 'done' | 'all';

export type TaskWithPatient = AshaTask & { patient_name: string | null; household_hhid: string | null };

/**
 * Tasks joined to their subject, which is what every task list row renders.
 *
 * `all` means every row the worker can act on, not every row in the table:
 * cancelled tasks are duplicates the plan cleaned up (the web drops them in
 * useTodayTasks before they ever reach the list), so leaving them in inflated
 * the All count and the pending/done split underneath it.
 */
export async function listTasks(filter: TaskFilter = 'all'): Promise<TaskWithPatient[]> {
  const db = await getDatabase();
  const where =
    filter === 'pending'
      ? `WHERE t.status IS NULL OR t.status NOT IN ('completed', 'done', 'cancelled')`
      : filter === 'done'
        ? `WHERE t.status IN ('completed', 'done')`
        : `WHERE t.status IS NULL OR t.status <> 'cancelled'`;

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

  const [todayAgenda, pendingTasks, households, highRiskPregnancies, highRiskBeneficiaries] = await Promise.all([
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
    // The web's KPI is high-risk pregnancies PLUS high-risk beneficiaries
    // (AshaWorkerHomeAshaSathi.tsx), where a beneficiary's own level is the
    // intake annotation stored in beneficiaries.metadata_json.risk - the same
    // value listPatients ranks as `intakeRisk`. One flat COUNT over the local
    // table, so it stays offline-safe; json_valid() keeps a malformed metadata
    // blob from failing the whole KPI read.
    scalar(
      `SELECT COUNT(*) AS value FROM beneficiaries
        WHERE LOWER(COALESCE(json_extract(
                 CASE WHEN json_valid(metadata_json) THEN metadata_json END, '$.risk'), ''))
              IN ('high','high_risk')`,
    ),
  ]);

  return { todayAgenda, pendingTasks, households, highRisk: highRiskPregnancies + highRiskBeneficiaries };
}

export type HouseholdMember = {
  id: string;
  full_name: string;
  gender: string | null;
  age_years: number | null;
  age_months: number | null;
  relationship_to_head: string | null;
  /** True when this member is the patient whose detail screen is open. */
  isSubject: boolean;
};

/** Co-members of a household, so the detail page's member list is real. */
export async function listHouseholdMembers(householdId: string, subjectId: string): Promise<HouseholdMember[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT id, full_name, gender, age_years, age_months, relationship_to_head
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
    relationship_to_head:
      row.relationship_to_head === null || row.relationship_to_head === undefined
        ? null
        : String(row.relationship_to_head),
    isSubject: String(row.id) === subjectId,
  }));
}

export async function getHouseholdAddress(householdId: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ address: string | null }>('SELECT address FROM households WHERE id = ?', householdId);
  return row?.address ?? null;
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
  kind: 'overdue' | 'due' | 'referral' | 'immunization' | 'patient_update';
  title: string;
  body: string | null;
  date: string | null;
  severity: 'high' | 'medium' | 'low';
  /**
   * Beneficiary the row points at, when it has one - an immunization alert can
   * therefore open the child's immunization schedule instead of stopping at
   * "there is something to look at".
   */
  patient_id?: string | null;
};

/**
 * Read server-synced notifications (e.g. "patient updated their profile")
 * from the local `notifications` table. These arrive via the sync pull and
 * are merged with the locally-derived clinical alerts on the Notifications
 * screen.
 */
export async function listServerNotifications(): Promise<AppNotification[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    type: string;
    title: string;
    message: string | null;
    created_at: string | null;
  }>('SELECT id, type, title, message, created_at FROM notifications ORDER BY created_at DESC LIMIT 100');
  return rows.map((row) => ({
    id: row.id,
    kind: (row.type === 'patient_profile_updated' ? 'patient_update' : 'due') as AppNotification['kind'],
    title: row.title,
    body: row.message,
    date: row.created_at,
    severity: 'medium' as const,
  }));
}

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

  const immunizations = await db.getAllAsync<{ id: string; vaccine_name: string | null; due_date: string | null; patient_name: string | null; patient_id: string | null }>(
    `SELECT i.id, i.vaccine_name, i.due_date, b.full_name AS patient_name, b.id AS patient_id
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
      patient_id: r.patient_id,
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

// --- Local writes for the ASHA module forms --------------------------------

/**
 * Local create for the clinical tables.
 *
 * `upsertRows` compiles to `ON CONFLICT(id)`, but only `households`,
 * `beneficiaries` and `village_forms` declare a PRIMARY KEY - the conflict
 * clause is rejected outright on `pregnancies`, `children`, `referrals`,
 * `ncd_screenings` and `anc_visits`. The module forms mint a fresh local id on
 * every submit and the task refresh re-reads the same ids, so the statement is
 * a delete-by-id followed by an INSERT: idempotent without needing a unique
 * constraint that most of these tables do not have.
 */
export async function saveRows(table: TableName, records: Array<Record<string, unknown>>): Promise<void> {
  if (records.length === 0) return;
  const columns = TABLES[table];
  if (!columns.includes('id')) {
    throw new Error(`table ${table} has no id column; saveRows requires one`);
  }

  const columnList = columns.map(quote).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const insert = `INSERT INTO ${quote(table)} (${columnList}) VALUES (${placeholders})`;
  const remove = `DELETE FROM ${quote(table)} WHERE ${quote('id')} = ?`;
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    for (const record of records) {
      const id = record.id;
      if (typeof id === 'string' && id !== '') await db.runAsync(remove, id);
      await db.runAsync(insert, ...pick(record, columns));
    }
  });
}

export type TaskMeta = { carried_from?: unknown; [key: string]: unknown };

/**
 * Reads the `asha_tasks` JSON blob.
 *
 * The local column is `metadata`, but the server serialises the same column as
 * `metadata_json`, so a row that has just come off the wire carries the other
 * spelling. Both are accepted rather than trusting either one.
 */
export function readTaskMetadata(task: object): TaskMeta {
  const source = task as { metadata?: unknown; metadata_json?: unknown };
  const raw = source.metadata ?? source.metadata_json;
  if (typeof raw !== 'string' || raw === '') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as TaskMeta) : {};
  } catch {
    return {};
  }
}

// --- Follow-up completion ---------------------------------------------------

/** Completed referrals and tasks, i.e. the history the follow-up list used to drop. */
export async function listFollowUpHistory(): Promise<FollowUp[]> {
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
        AND COALESCE(r.status, '') IN ('completed', 'cancelled')
      ORDER BY r.followup_date DESC`,
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
      WHERE COALESCE(t.status, '') IN ('completed', 'done')
      ORDER BY t.completed_time DESC`,
  );

  return [
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
}

/**
 * Flip one merged follow-up between done and pending.
 *
 * The row id is namespaced by source (`task:<id>` / `referral:<id>`) because
 * listFollowUps merges two tables; the id after the colon is the real record.
 * Both writes go to SQLite and the outbox together, exactly like setTaskStatus,
 * so a completion recorded with no signal is not lost.
 */
export async function setFollowUpDone(row: FollowUp, done: boolean): Promise<void> {
  const db = await getDatabase();
  const id = row.id.slice(row.id.indexOf(':') + 1);

  if (row.kind === 'task') {
    const task = await db.getFirstAsync<AshaTask>('SELECT * FROM asha_tasks WHERE id = ?', id);
    if (task) await setTaskStatus(task, done);
    return;
  }

  const current = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM referrals WHERE id = ?', id);
  if (!current) return;
  const { version, ...fields } = current;
  const status = done ? 'completed' : 'pending';

  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE referrals SET status = ? WHERE id = ?`, status, id);
    await enqueue({
      clientRequestId: `update-referral-${id}`,
      entity: 'referrals',
      operation: 'update',
      recordId: id,
      version: Number(version ?? 1),
      data: { ...fields, status },
    });
  });
}

/**
 * Move one merged follow-up to a new date.
 *
 * Same local + outbox contract as setFollowUpDone: the column that carries the
 * deadline (`asha_tasks.task_date` / `referrals.followup_date`) and the server
 * copy are written together, so a date changed in a village with no signal is
 * not lost. The idempotency key carries the new date because the server
 * replays an already-processed `client_request_id` instead of re-applying it —
 * a second reschedule under a fixed key would silently keep the first date.
 */
export async function setFollowUpDate(row: FollowUp, nextDate: string): Promise<void> {
  const db = await getDatabase();
  const id = row.id.slice(row.id.indexOf(':') + 1);

  if (row.kind === 'task') {
    const task = await db.getFirstAsync<AshaTask>('SELECT * FROM asha_tasks WHERE id = ?', id);
    if (!task) return;
    const { version, ...fields } = task;

    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE asha_tasks SET task_date = ? WHERE id = ?', nextDate, id);
      await enqueue({
        clientRequestId: `reschedule-task-${id}-${nextDate}`,
        entity: 'asha_tasks',
        operation: 'update',
        recordId: id,
        version,
        data: { ...fields, task_date: nextDate },
      });
    });
    return;
  }

  const current = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM referrals WHERE id = ?', id);
  if (!current) return;
  const { version, ...fields } = current;

  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE referrals SET followup_date = ? WHERE id = ?', nextDate, id);
    await enqueue({
      clientRequestId: `reschedule-referral-${id}-${nextDate}`,
      entity: 'referrals',
      operation: 'update',
      recordId: id,
      version: Number(version ?? 1),
      data: { ...fields, followup_date: nextDate },
    });
  });
}

// --- Notification read state ------------------------------------------------

/**
 * Which notifications the worker has already opened.
 *
 * The rows themselves are derived from synced tables rather than stored, so
 * there is no column to flip. The read set lives in `sync_metadata` instead -
 * a key/value table that is part of the app's own plumbing rather than a synced
 * entity, which is exactly the scope a UI-only flag wants.
 */
const READ_NOTIFICATIONS_KEY = 'read_notifications';

/**
 * Fired after the read set changes, so the bell badge can recompute without
 * waiting for a sync or a foreground transition. The badge lives on other
 * screens (useShellChrome), which have no way to observe this table otherwise.
 */
type ReadListener = () => void;
const readListeners = new Set<ReadListener>();

export function subscribeNotificationRead(listener: ReadListener): () => void {
  readListeners.add(listener);
  return () => {
    readListeners.delete(listener);
  };
}

function emitNotificationRead(): void {
  for (const listener of [...readListeners]) listener();
}

async function readNotificationIds(): Promise<Set<string>> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM sync_metadata WHERE key = ?',
    READ_NOTIFICATIONS_KEY,
  );
  if (!row?.value) return new Set();
  try {
    const parsed: unknown = JSON.parse(row.value);
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

async function writeNotificationIds(ids: Set<string>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sync_metadata (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    READ_NOTIFICATIONS_KEY,
    JSON.stringify([...ids]),
  );
}

export async function getReadNotificationIds(): Promise<Set<string>> {
  return readNotificationIds();
}

export async function setNotificationRead(id: string, read: boolean): Promise<void> {
  const ids = await readNotificationIds();
  const wasRead = ids.has(id);
  if (read) ids.add(id);
  else ids.delete(id);
  if (ids.has(id) === wasRead) return;
  await writeNotificationIds(ids);
  emitNotificationRead();
}

export async function setAllNotificationsRead(ids: readonly string[]): Promise<void> {
  const read = await readNotificationIds();
  let changed = false;
  for (const id of ids) {
    if (!read.has(id)) {
      read.add(id);
      changed = true;
    }
  }
  if (!changed) return;
  await writeNotificationIds(read);
  emitNotificationRead();
}

// --- Household field flow --------------------------------------------------
//
// The assigned-households list, the household detail page and the visit survey
// all read from local SQLite so they work with no signal at all. Everything a
// card renders is derived here rather than stored: the village name is not in
// the local `households` DDL (see src/db/tables.ts), so the location falls
// back to `address`, and the head is the oldest adult member when neither the
// members nor the registration-time `head_name` know one.

export type HouseholdCard = {
  id: string;
  hhid: string | null;
  address: string | null;
  village_id: string | null;
  head_name: string | null;
  members: number;
  pregnant: number;
  children_under5: number;
  open_tasks: number;
  completed_tasks: number;
  next_task_date: string | null;
  last_visit_date: string | null;
};

const OPEN_TASK = `(t.status IS NULL OR t.status NOT IN ('completed','done','cancelled'))`;
const ACTIVE_PREGNANCY = `(p.status IS NULL OR p.status NOT IN ('delivered','aborted','closed'))`;

const HOUSEHOLD_CARD_SQL = `
  SELECT h.id, h.hhid, h.address, h.village_id,
         COALESCE((SELECT b.full_name FROM beneficiaries b
           WHERE b.household_id = h.id
           ORDER BY (b.age_years IS NULL), b.age_years DESC, b.full_name ASC
           LIMIT 1), h.head_name) AS head_name,
         (SELECT COUNT(*) FROM beneficiaries b
           WHERE b.household_id = h.id) AS members,
         (SELECT COUNT(DISTINCT b.id) FROM beneficiaries b
           JOIN pregnancies p ON p.beneficiary_id = b.id
          WHERE b.household_id = h.id AND ${ACTIVE_PREGNANCY}) AS pregnant,
         (SELECT COUNT(*) FROM beneficiaries b
          WHERE b.household_id = h.id
            AND ((b.age_years IS NOT NULL AND b.age_years < 5)
              OR (b.age_years IS NULL AND b.age_months IS NOT NULL AND b.age_months < 60))) AS children_under5,
         (SELECT COUNT(*) FROM asha_tasks t
          WHERE t.household_id = h.id AND ${OPEN_TASK}) AS open_tasks,
         (SELECT COUNT(*) FROM asha_tasks t
          WHERE t.household_id = h.id AND t.status IN ('completed','done')) AS completed_tasks,
         (SELECT MIN(COALESCE(t.task_date, substr(COALESCE(t.completed_time, ''), 1, 10)))
            FROM asha_tasks t
           WHERE t.household_id = h.id AND ${OPEN_TASK}) AS next_task_date,
         (SELECT MAX(COALESCE(t.task_date, substr(COALESCE(t.completed_time, ''), 1, 10)))
            FROM asha_tasks t
           WHERE t.household_id = h.id AND t.status IN ('completed','done')) AS last_visit_date
    FROM households h
`;

/** MIN/MAX over an empty task set comes back as `''`, which would read as a date. */
function toCard(row: Record<string, unknown>): HouseholdCard {
  const date = (value: unknown) => (value === null || value === undefined || value === '' ? null : String(value));
  return {
    id: String(row.id),
    hhid: row.hhid === null || row.hhid === undefined ? null : String(row.hhid),
    address: row.address === null || row.address === undefined ? null : String(row.address),
    village_id: row.village_id === null || row.village_id === undefined ? null : String(row.village_id),
    head_name: row.head_name === null || row.head_name === undefined ? null : String(row.head_name),
    members: Number(row.members ?? 0),
    pregnant: Number(row.pregnant ?? 0),
    children_under5: Number(row.children_under5 ?? 0),
    open_tasks: Number(row.open_tasks ?? 0),
    completed_tasks: Number(row.completed_tasks ?? 0),
    next_task_date: date(row.next_task_date),
    last_visit_date: date(row.last_visit_date),
  };
}

export async function listHouseholdCards(): Promise<HouseholdCard[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(`${HOUSEHOLD_CARD_SQL} ORDER BY h.hhid ASC`);
  return rows.map(toCard);
}

export async function getHouseholdCard(id: string): Promise<HouseholdCard | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(`${HOUSEHOLD_CARD_SQL} WHERE h.id = ?`, id);
  return row ? toCard(row) : null;
}

export type HouseholdMemberCard = {
  id: string;
  full_name: string;
  gender: string | null;
  age_years: number | null;
  age_months: number | null;
  phone: string | null;
  relationship_to_head: string | null;
  is_pregnant: number;
  risk_level: string | null;
  edd: string | null;
};

export async function listHouseholdMemberCards(householdId: string): Promise<HouseholdMemberCard[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT b.id, b.full_name, b.gender, b.age_years, b.age_months, b.phone,
            b.relationship_to_head,
            (SELECT COUNT(*) FROM pregnancies p
              WHERE p.beneficiary_id = b.id AND ${ACTIVE_PREGNANCY}) AS is_pregnant,
            (SELECT p.risk_level FROM pregnancies p
              WHERE p.beneficiary_id = b.id AND ${ACTIVE_PREGNANCY}
              ORDER BY COALESCE(p.edd, '') DESC LIMIT 1) AS risk_level,
            (SELECT p.edd FROM pregnancies p
              WHERE p.beneficiary_id = b.id AND ${ACTIVE_PREGNANCY}
              ORDER BY COALESCE(p.edd, '') DESC LIMIT 1) AS edd
       FROM beneficiaries b
      WHERE b.household_id = ?
      ORDER BY (b.age_years IS NULL), b.age_years DESC, b.full_name ASC`,
    householdId,
  );
  return rows.map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name ?? ''),
    gender: row.gender === null || row.gender === undefined ? null : String(row.gender),
    age_years: row.age_years === null || row.age_years === undefined ? null : Number(row.age_years),
    age_months: row.age_months === null || row.age_months === undefined ? null : Number(row.age_months),
    phone: row.phone === null || row.phone === undefined ? null : String(row.phone),
    relationship_to_head:
      row.relationship_to_head === null || row.relationship_to_head === undefined
        ? null
        : String(row.relationship_to_head),
    is_pregnant: Number(row.is_pregnant ?? 0),
    risk_level: row.risk_level === null || row.risk_level === undefined ? null : String(row.risk_level),
    edd: row.edd === null || row.edd === undefined ? null : String(row.edd),
  }));
}

/** Outstanding tasks for one household - the rows a completed visit closes. */
export async function listHouseholdVisitTasks(householdId: string): Promise<AshaTask[]> {
  const db = await getDatabase();
  return db.getAllAsync<AshaTask>(
    `SELECT t.* FROM asha_tasks t
      WHERE t.household_id = ? AND ${OPEN_TASK}
      ORDER BY COALESCE(t.task_date, '') ASC`,
    householdId,
  );
}

/**
 * Close every open task on a household, mirroring what POST /households/{id}/survey
 * does server-side.
 *
 * `queue: false` is the online path: the server has already completed them, so
 * the local rows are only catching up and an outbox copy would arrive with a
 * version the server has just passed. `queue: true` is the offline path, where
 * the completion exists nowhere else and must be pushed later.
 */
export async function completeHouseholdTasks(householdId: string, queue: boolean): Promise<number> {
  const tasks = await listHouseholdVisitTasks(householdId);
  if (tasks.length === 0) return 0;

  if (queue) {
    for (const task of tasks) await setTaskStatus(task, true);
    return tasks.length;
  }

  const db = await getDatabase();
  const completedAt = new Date().toISOString();
  await db.runAsync(
    `UPDATE asha_tasks SET status = 'completed', completed_time = ?
      WHERE household_id = ? AND ${OPEN_TASK}`,
    completedAt,
    householdId,
  );
  return tasks.length;
}

export type HouseholdVisitCheck = {
  id: string;
  household_id: string;
  survey_id: string | null;
  beneficiary_id: string | null;
  check_type: string;
  result: string;
  notes: string | null;
  visited_at: string | null;
  created_by: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type HouseholdVisitRecord = {
  id: string;
  visited_at: string | null;
  status: string | null;
  consent: boolean;
  answers: Record<string, unknown>;
};

/**
 * Visits recorded for a household.
 *
 * Surveys are captured into `village_forms` (the only survey-shaped table the
 * sync feed carries), so the history is that table filtered down to the
 * household in the JSON payload.
 */
export async function listHouseholdVisitRecords(householdId: string): Promise<HouseholdVisitRecord[]> {
  const forms = await listVillageForms('household_visit');
  return forms
    .filter((form) => readFormData(form).household_id === householdId)
    .map((form) => {
      const answers = readFormData(form);
      return {
        id: form.id,
        visited_at: form.form_date,
        status: form.status,
        consent: answers.consent_obtained === true,
        answers,
      };
    });
}

/**
 * Member checks recorded during household visits for a specific beneficiary.
 * Includes photo URLs for offline viewing.
 */
export async function listHouseholdVisitChecksForBeneficiary(beneficiaryId: string): Promise<HouseholdVisitCheck[]> {
  const db = await getDatabase();
  return db.getAllAsync<HouseholdVisitCheck>(
    `SELECT id, household_id, survey_id, beneficiary_id, check_type, result, notes,
            visited_at, created_by, photo_url, created_at, updated_at, version
       FROM household_visit_checks
      WHERE beneficiary_id = ?
      ORDER BY visited_at DESC, created_at DESC`,
    beneficiaryId,
  );
}

/** Local commit for a household registered in the field (offline-first). */
export async function insertLocalHousehold(input: {
  id: string;
  hhid: string;
  villageId: string;
  ashaId: string;
  address: string | null;
  consentGiven: boolean;
  headName: string | null;
  /** Amenities captured at registration — stored as a JSON object like the server's JSON column. */
  amenities?: Record<string, boolean> | null;
}): Promise<void> {
  const db = await getDatabase();
  const updatedAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO households (id, hhid, village_id, asha_id, address, consent_given, head_name, amenities, version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(id) DO UPDATE SET
       hhid = excluded.hhid,
       village_id = excluded.village_id,
       asha_id = excluded.asha_id,
       address = excluded.address,
       consent_given = excluded.consent_given,
       head_name = excluded.head_name,
       amenities = excluded.amenities,
       updated_at = excluded.updated_at`,
    input.id,
    input.hhid,
    input.villageId,
    input.ashaId,
    input.address,
    input.consentGiven ? 1 : 0,
    input.headName,
    input.amenities ? JSON.stringify(input.amenities) : null,
    updatedAt,
  );
}

export type ChildOption = Child & { child_name: string | null; dose_count: number };

const CHILD_OPTION_SELECT = `
  SELECT c.*, b.full_name AS child_name,
         (SELECT COUNT(*) FROM immunizations i WHERE i.child_id = c.id) AS dose_count
    FROM children c
    LEFT JOIN beneficiaries b ON b.id = c.beneficiary_id
`;

export async function listChildrenInHousehold(householdId: string): Promise<ChildOption[]> {
  const db = await getDatabase();
  return db.getAllAsync<ChildOption>(
    `${CHILD_OPTION_SELECT}
       LEFT JOIN households h ON h.id = b.household_id
      WHERE h.id = ?
      ORDER BY c.created_at ASC`,
    householdId,
  );
}

export async function listChildrenForBeneficiary(beneficiaryId: string): Promise<ChildOption[]> {
  const db = await getDatabase();
  return db.getAllAsync<ChildOption>(
    `${CHILD_OPTION_SELECT}
      WHERE c.beneficiary_id = ?
      ORDER BY c.created_at ASC`,
    beneficiaryId,
  );
}

export type PatientVitals = {
  height_cm: number | null;
  weight_kg: number | null;
  blood_group: string | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
};

/**
 * Latest vitals for a beneficiary.
 *
 * Height, weight and blood group only exist on an antenatal visit, and blood
 * pressure lives on both the ANC visit and the NCD screening. The screening
 * wins for BP because it is the more recent reading when both exist; a patient
 * with neither gets nulls and the screen prints "not recorded" rather than a
 * fabricated number.
 */
export async function getPatientVitals(beneficiaryId: string): Promise<PatientVitals> {
  const db = await getDatabase();

  const anc = await db.getFirstAsync<PatientVitals>(
    `SELECT av.height_cm, av.weight_kg, av.blood_group, av.bp_systolic, av.bp_diastolic
       FROM anc_visits av
       JOIN pregnancies p ON p.id = av.pregnancy_id
      WHERE p.beneficiary_id = ?
      ORDER BY COALESCE(av.visit_date, '') DESC
      LIMIT 1`,
    beneficiaryId,
  );

  const screening = await db.getFirstAsync<{ bp_systolic: number | null; bp_diastolic: number | null }>(
    `SELECT bp_systolic, bp_diastolic
       FROM ncd_screenings
      WHERE beneficiary_id = ?
      ORDER BY COALESCE(screening_date, created_at) DESC
      LIMIT 1`,
    beneficiaryId,
  );

  return {
    height_cm: anc?.height_cm ?? null,
    weight_kg: anc?.weight_kg ?? null,
    blood_group: anc?.blood_group ?? null,
    bp_systolic: screening?.bp_systolic ?? anc?.bp_systolic ?? null,
    bp_diastolic: screening?.bp_diastolic ?? anc?.bp_diastolic ?? null,
  };
}

/**
 * Local create for a check-up recorded on the New Check-up screen.
 *
 * Offline-first like the other module forms: SQLite commits first and the
 * caller enqueues the matching outbox entry, so the reading is on the device
 * the moment the ASHA taps save and uploads whenever the network allows.
 *
 * The screening questions (`tobacco_use`, `known_diabetes`, …) are NOT NULL on
 * both the local table and the server model but are not asked by this vitals
 * form, so they take the same defaults the server model declares rather than a
 * fabricated answer.
 */
export async function insertLocalNcdScreening(input: {
  id: string;
  beneficiaryId: string;
  screeningDate: string;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  bloodSugarRandom: number | null;
  recordedBy?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO ncd_screenings
       (id, beneficiary_id, screening_date, age_above_30, tobacco_use, alcohol_use,
        physical_activity, family_history_diabetes, family_history_hypertension,
        family_history_cancer, known_diabetes, known_hypertension, known_cancer,
        bp_systolic, bp_diastolic, blood_sugar_random, referral_made, recorded_by,
        created_at, updated_at, version)
     VALUES (?, ?, ?, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, ?, ?, ?, 0, ?, ?, ?, 1)`,
    input.id,
    input.beneficiaryId,
    input.screeningDate,
    input.bpSystolic,
    input.bpDiastolic,
    input.bloodSugarRandom,
    input.recordedBy ?? null,
    now,
    now,
  );
}

// --- Module form creates ----------------------------------------------------
//
// Pregnancy, child and referral registration write the same way the check-up
// form does: SQLite commits first and the caller enqueues the matching outbox
// row, so the record exists on the device immediately and uploads whenever the
// network allows. Columns the form does not ask for take the defaults the
// server model declares, so the local row and the pushed row match.

/**
 * Local create for a pregnancy registered from the Pregnancy Tracking screen.
 *
 * `anc_count`, `risk_level` and `status` are NOT NULL locally and get the same
 * defaults the server's PregnancyCreate applies. Trimester/week are not stored:
 * the server model has no such column, so they are derived from lmp/edd at read
 * time rather than collected and dropped by `_clean_columns`.
 */
export async function insertLocalPregnancy(input: {
  id: string;
  beneficiaryId: string;
  lmp: string | null;
  edd: string | null;
  riskLevel: string;
  riskFactors: Record<string, unknown> | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO pregnancies
       (id, beneficiary_id, lmp, edd, risk_level, risk_factors, anc_count, status,
        created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'ongoing', ?, ?, 1)
     ON CONFLICT(id) DO UPDATE SET
       beneficiary_id = excluded.beneficiary_id,
       lmp = excluded.lmp,
       edd = excluded.edd,
       risk_level = excluded.risk_level,
       risk_factors = excluded.risk_factors,
       updated_at = excluded.updated_at`,
    input.id,
    input.beneficiaryId,
    input.lmp,
    input.edd,
    input.riskLevel,
    input.riskFactors ? JSON.stringify(input.riskFactors) : null,
    now,
    now,
  );
}

/**
 * Local create for a child registered from the Child Health screen.
 *
 * The mother is a bare-string link (required at the API layer, nullable in the
 * schema) so a push whose mother row arrives in the same batch still lands; the
 * father is optional. Name, date of birth, household and village belong to the
 * child's `beneficiaries` row, which the form selects rather than creates.
 */
export async function insertLocalChild(input: {
  id: string;
  beneficiaryId: string;
  motherId: string;
  fatherId: string | null;
  birthWeightGrams: number | null;
  birthLengthCm: number | null;
  gestationWeeks: number | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO children
       (id, beneficiary_id, mother_id, father_id, birth_weight_grams, birth_length_cm,
        gestation_weeks, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(id) DO UPDATE SET
       beneficiary_id = excluded.beneficiary_id,
       mother_id = excluded.mother_id,
       father_id = excluded.father_id,
       birth_weight_grams = excluded.birth_weight_grams,
       birth_length_cm = excluded.birth_length_cm,
       gestation_weeks = excluded.gestation_weeks,
       updated_at = excluded.updated_at`,
    input.id,
    input.beneficiaryId,
    input.motherId,
    input.fatherId,
    input.birthWeightGrams,
    input.birthLengthCm,
    input.gestationWeeks,
    now,
    now,
  );
}

/**
 * Local create for a referral raised from the Referrals screen.
 *
 * `referral_type`, `urgency`, `status` and `followup_required` are NOT NULL on
 * the local table; they take the server model's defaults ('general' is what the
 * web form sends, 'initiated' is Referral.status's default — the web maps that
 * back to its "Pending" tab, as does the referrals list here).
 */
export async function insertLocalReferral(input: {
  id: string;
  beneficiaryId: string;
  referralType: string;
  urgency: string;
  reason: string | null;
  referredFromId: string | null;
  referredFromFacilityId: string | null;
  referredToFacilityId: string | null;
  initiatedAt: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO referrals
       (id, beneficiary_id, referral_type, urgency, reason, referred_from_id,
        referred_from_facility_id, referred_to_facility_id, status, initiated_at,
        followup_required, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'initiated', ?, 0, ?, ?, 1)
     ON CONFLICT(id) DO UPDATE SET
       beneficiary_id = excluded.beneficiary_id,
       referral_type = excluded.referral_type,
       urgency = excluded.urgency,
       reason = excluded.reason,
       referred_from_id = excluded.referred_from_id,
       referred_from_facility_id = excluded.referred_from_facility_id,
       referred_to_facility_id = excluded.referred_to_facility_id,
       initiated_at = excluded.initiated_at,
       updated_at = excluded.updated_at`,
    input.id,
    input.beneficiaryId,
    input.referralType,
    input.urgency,
    input.reason,
    input.referredFromId,
    input.referredFromFacilityId,
    input.referredToFacilityId,
    input.initiatedAt,
    now,
    now,
  );
}
