import {
  listChildren,
  listImmunizations,
  listNcdScreenings,
  listPregnancies,
  type Child,
} from '@/db/clinical';

import { NOT_RECORDED } from './profile';
import type { HealthRecord, VaccineDose } from './types';

/**
 * The patient's health records, built from the locally synced rows.
 *
 * The web page reads `useAppStore.healthRecords`, which its ASHA flows fill
 * with check-up / child-registration entries; mobile builds the same entries
 * from SQLite instead, so a patient sees their records with no network. The
 * detail labels are English exactly like the web store's literals (the web
 * renders them untranslated too) — only the page chrome is i18n'd.
 */

function displayDate(iso: string | null | undefined): string {
  if (!iso) return NOT_RECORDED;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return NOT_RECORDED;
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function detail(label: string, value: string | number | null | undefined, suffix = ''): {
  label: string;
  value: string;
} | null {
  if (value == null || value === '') return null;
  return { label, value: `${value}${suffix}` };
}

function screeningRecord(s: Awaited<ReturnType<typeof listNcdScreenings>>[number]): HealthRecord {
  const details = [
    detail('Blood Pressure', s.bp_systolic != null && s.bp_diastolic != null ? `${s.bp_systolic}/${s.bp_diastolic}` : null, ' mmHg'),
    detail('Random Blood Sugar', s.blood_sugar_random, ' mg/dL'),
    detail('Waist Circumference', s.waist_circumference_cm, ' cm'),
    detail('CBAC Score', s.cbac_score),
    detail('Diabetes Risk', s.diabetes_risk),
    detail('Hypertension Risk', s.hypertension_risk),
    detail('Cardiovascular Risk', s.cardiovascular_risk),
    detail('Cancer Risk', s.cancer_risk),
  ].filter((d): d is { label: string; value: string } => d !== null);

  return {
    id: `hr-${s.id}`,
    category: 'checkup',
    title: 'Health Check-up',
    date: displayDate(s.screening_date ?? s.created_at),
    facility: NOT_RECORDED,
    details,
    downloadable: true,
  };
}

function childRegistrationRecord(c: Child, doses: number, done: number): HealthRecord {
  const details = [
    detail('Date of Birth', displayDate(c.created_at)),
    detail('Birth Weight', c.birth_weight_grams != null ? Math.round(c.birth_weight_grams / 100) / 10 : null, ' kg'),
    detail('Birth Length', c.birth_length_cm, ' cm'),
    detail('Gestation', c.gestation_weeks, ' weeks'),
    detail('Delivery Type', c.delivery_type),
    detail('Place of Birth', c.place_of_birth),
    detail('Immunization', doses > 0 ? `${done}/${doses} done` : null),
  ].filter((d): d is { label: string; value: string } => d !== null);

  return {
    id: `hr-child-${c.id}`,
    category: 'checkup',
    title: 'Child Health Registration',
    date: displayDate(c.created_at),
    facility: NOT_RECORDED,
    details,
    downloadable: true,
  };
}

/**
 * Check-up and child-registration records, newest first. Prescriptions and lab
 * reports have no offline source yet (the web's are store rows no flow creates
 * anymore), so those tabs stay empty on both platforms.
 *
 * The local DB only ever holds rows inside the signed-in patient's sync scope,
 * so no beneficiary filter is needed — "everything local" already means
 * "everything this patient may see".
 */
export async function buildHealthRecords(): Promise<HealthRecord[]> {
  const [screenings, children] = await Promise.all([listNcdScreenings(), listChildren()]);

  const childRecords = await Promise.all(
    children.map(async (child) => {
      const immunizations = await listImmunizations(child.id);
      const done = immunizations.filter((row) => row.status === 'given').length;
      return childRegistrationRecord(child, immunizations.length, done);
    }),
  );

  return [...screenings.map(screeningRecord), ...childRecords];
}

// --- Pregnancy summary (records page) ---------------------------------------

export type LocalPregnancySummary = {
  trimester: number | null;
  week: number | null;
  edd: string;
  ancVisits: number;
  lmp: string;
  risk: string;
};

/** Gestational age from LMP, the same 1-12 / 13-27 / 28+ split the server uses. */
function gestationFromLmp(lmp: string | null): { trimester: number | null; week: number | null } {
  if (!lmp) return { trimester: null, week: null };
  const start = new Date(lmp);
  if (Number.isNaN(start.getTime())) return { trimester: null, week: null };
  const days = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  if (days < 0) return { trimester: null, week: null };
  const week = Math.floor(days / 7);
  return { trimester: week <= 12 ? 1 : week <= 27 ? 2 : 3, week };
}

/**
 * The newest pregnancy's summary for the records page. Empty when the patient
 * is not pregnant (or has no synced pregnancy row), which is exactly when the
 * web page hides the card too.
 */
export async function loadLocalPregnancy(): Promise<LocalPregnancySummary | null> {
  const pregnancies = await listPregnancies();
  const current = pregnancies.find((row) => row.status !== 'completed') ?? pregnancies[0];
  if (!current) return null;
  const { trimester, week } = gestationFromLmp(current.lmp);
  return {
    trimester,
    week,
    edd: displayDate(current.edd),
    ancVisits: current.anc_count,
    lmp: displayDate(current.lmp),
    risk: current.risk_level ? current.risk_level.charAt(0).toUpperCase() + current.risk_level.slice(1) : NOT_RECORDED,
  };
}

// --- Child rows (records page child card + vaccination header) --------------

export type LocalChildSummary = {
  id: string;
  /** Best available label: birth registration number, else a plain "Child". */
  label: string;
  subtitle: string;
  doses: VaccineDose[];
  done: number;
};

const DOSE_STATUS_KEY: Record<string, VaccineDose['status']> = {
  given: 'given',
  due: 'due',
  overdue: 'overdue',
  upcoming: 'upcoming',
};

/**
 * Children with their immunization doses, mapped to the vaccine-dose shape the
 * web's `childVaccines` store used. Dose dates/status come straight from the
 * synced immunizations rows.
 */
export async function loadLocalChildren(): Promise<LocalChildSummary[]> {
  const children = await listChildren();
  return Promise.all(
    children.map(async (child) => {
      const rows = await listImmunizations(child.id);
      const doses: VaccineDose[] = rows.map((row) => ({
        id: row.id,
        name: row.vaccine_name ?? 'Vaccine',
        vaccines: `Dose ${row.dose_number ?? '—'}`,
        date: displayDate(row.given_date ?? row.due_date),
        status: DOSE_STATUS_KEY[String(row.status ?? '').toLowerCase()] ?? 'upcoming',
      }));
      const months = child.created_at
        ? Math.max(0, Math.floor((Date.now() - new Date(child.created_at).getTime()) / 2_629_800_000))
        : null;
      return {
        id: child.id,
        label: child.birth_registration_no ?? 'Child',
        subtitle: months != null ? `${months} mo` : '',
        doses,
        done: doses.filter((dose) => dose.status === 'given').length,
      };
    }),
  );
}
