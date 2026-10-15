/**
 * Date helpers for date-of-birth entry.
 *
 * The field stores ISO `YYYY-MM-DD` - what SQLite's `date()` arithmetic, the
 * local schema and the server all expect - and presets the *display* format
 * to DD/MM/YYYY (the format Indian users write by hand).
 */

/** Local-time Date for an ISO `YYYY-MM-DD` string; null when not a real date. */
export function isoToDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Round-tripping through the Date constructor rejects 31/02, month 13, ...
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/** ISO `YYYY-MM-DD` from the Date's *local* components (never UTC-shifted). */
export function dateToIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The preset display format DD/MM/YYYY; '' for empty or invalid input. */
export function isoToDisplay(iso: string): string {
  if (!isoToDate(iso)) return '';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** Today as ISO, for "cannot be in the future" checks. */
export function todayIso(): string {
  return dateToIso(new Date());
}
