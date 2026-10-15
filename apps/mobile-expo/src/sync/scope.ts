/**
 * Client mirror of the backend's push scope (`app/services/sync_scope.py`).
 *
 * The server is the authority - `allowed_tables_for` rejects a push the
 * signed-in role may not write - but asking it to reject rows we can already
 * tell it will refuse just burns the outbox: every attempt spends a network
 * round trip and a retry on a `forbidden` result that can never turn into a
 * success. Checking here means a forbidden row fails once, visibly, with the
 * same reason the server would have returned.
 *
 * The list is `_NO_PATIENT_WRITE` from `sync_scope.py`: population-level rows
 * are ASHA-owned, so a patient account may only push its own beneficiary
 * record and the clinical rows hanging off it. Supervisors (`admin`) and
 * workers may write anything.
 */

/** Entities a `patient` session may never push, mirroring `_NO_PATIENT_WRITE`. */
export const PATIENT_FORBIDDEN_ENTITIES: readonly string[] = [
  'households',
  'asha_tasks',
  'village_forms',
  'household_visit_checks',
];

/** Whether a session with `role` may queue/push writes for `entity`. */
export function canWriteEntity(role: string | null | undefined, entity: string): boolean {
  if (role !== 'patient') return true;
  return !PATIENT_FORBIDDEN_ENTITIES.includes(entity);
}

/**
 * The reason the server would return for this push, or null when it is
 * allowed. Phrased like `allowed_tables_for`'s denial so the outbox row reads
 * the same whether the refusal happened here or on the wire.
 */
export function writeDenial(role: string | null | undefined, entity: string): string | null {
  if (canWriteEntity(role, entity)) return null;
  return `forbidden: role '${role}' may not write '${entity}'`;
}
