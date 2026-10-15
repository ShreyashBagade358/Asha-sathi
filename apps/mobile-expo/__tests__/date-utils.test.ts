import { dateToIso, isoToDate, isoToDisplay, todayIso } from '../src/utils/date';

/**
 * The DOB field presets DD/MM/YYYY for display while the DB, SQL `date()`
 * arithmetic and the server all keep ISO YYYY-MM-DD. These helpers are the
 * conversion between the two, so they carry the edge cases: impossible
 * calendar days, leap years, and timezone-safe Date construction.
 */

describe('isoToDate', () => {
  it('parses a real calendar date into local components', () => {
    const date = isoToDate('1990-02-28');
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(1990);
    expect(date!.getMonth()).toBe(1);
    expect(date!.getDate()).toBe(28);
  });

  it('rejects impossible calendar days', () => {
    expect(isoToDate('1990-02-31')).toBeNull();
    expect(isoToDate('1990-13-01')).toBeNull();
    expect(isoToDate('1990-00-10')).toBeNull();
    expect(isoToDate('1990-04-31')).toBeNull();
  });

  it('honours leap years', () => {
    expect(isoToDate('2000-02-29')).not.toBeNull();
    expect(isoToDate('1999-02-29')).toBeNull();
    expect(isoToDate('1900-02-29')).toBeNull();
  });

  it('rejects anything that is not YYYY-MM-DD', () => {
    expect(isoToDate('28/02/1990')).toBeNull();
    expect(isoToDate('1990-2-8')).toBeNull();
    expect(isoToDate('')).toBeNull();
    expect(isoToDate('not-a-date')).toBeNull();
  });
});

describe('dateToIso', () => {
  it('formats the local components, never the UTC ones', () => {
    // 1 Jan local: reading this via toISOString() in a UTC+ zone would leak
    // the previous year's December date.
    expect(dateToIso(new Date(1990, 0, 1))).toBe('1990-01-01');
    expect(dateToIso(new Date(2023, 11, 31))).toBe('2023-12-31');
  });

  it('zero-pads single-digit months and days', () => {
    expect(dateToIso(new Date(2005, 3, 7))).toBe('2005-04-07');
  });

  it('round-trips with isoToDate', () => {
    expect(dateToIso(isoToDate('1988-06-15')!)).toBe('1988-06-15');
  });
});

describe('isoToDisplay', () => {
  it('presets the DD/MM/YYYY format', () => {
    expect(isoToDisplay('1990-02-05')).toBe('05/02/1990');
    expect(isoToDisplay('2000-12-31')).toBe('31/12/2000');
  });

  it('shows nothing for empty or invalid values', () => {
    expect(isoToDisplay('')).toBe('');
    expect(isoToDisplay('1990-02-31')).toBe('');
    expect(isoToDisplay('garbage')).toBe('');
  });
});

describe('todayIso', () => {
  it('matches a fresh local-dateToIso conversion', () => {
    expect(todayIso()).toBe(dateToIso(new Date()));
  });
});
