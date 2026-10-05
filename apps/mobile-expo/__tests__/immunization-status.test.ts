import { deriveDoseStatus } from '../app/(app)/patient/[id]/immunization';

const TODAY = new Date(2026, 9, 1);

function dose(overrides: Partial<{ status: string | null; given_date: string | null; due_date: string | null }> = {}) {
  return {
    status: 'due' as string | null,
    given_date: null as string | null,
    due_date: null as string | null,
    ...overrides,
  };
}

describe('deriveDoseStatus', () => {
  it('reads a stored `given` status as administered', () => {
    expect(deriveDoseStatus(dose({ status: 'given', due_date: '2026-02-17' }), TODAY)).toBe('given');
  });

  it('reads a recorded administration date as given even when the schedule still says due', () => {
    expect(deriveDoseStatus(dose({ status: 'due', given_date: '2026-05-01' }), TODAY)).toBe('given');
  });

  it('keeps an explicitly overdue row overdue', () => {
    expect(deriveDoseStatus(dose({ status: 'overdue', due_date: '2026-11-01' }), TODAY)).toBe('overdue');
  });

  it('derives overdue from a due date in the past', () => {
    expect(deriveDoseStatus(dose({ status: 'due', due_date: '2026-09-30' }), TODAY)).toBe('overdue');
    expect(deriveDoseStatus(dose({ status: null, due_date: '2025-01-01' }), TODAY)).toBe('overdue');
  });

  it('shows a dose due today as due', () => {
    expect(deriveDoseStatus(dose({ status: 'due', due_date: '2026-10-01' }), TODAY)).toBe('due');
  });

  it('shows a dose with no due date as due', () => {
    expect(deriveDoseStatus(dose({ status: 'due', due_date: null }), TODAY)).toBe('due');
  });

  it('shows a dose scheduled in the future as upcoming', () => {
    expect(deriveDoseStatus(dose({ status: 'due', due_date: '2026-10-13' }), TODAY)).toBe('upcoming');
    expect(deriveDoseStatus(dose({ status: 'due', due_date: '2026-12-12' }), TODAY)).toBe('upcoming');
  });

  it('treats a skipped dose as upcoming rather than due', () => {
    expect(deriveDoseStatus(dose({ status: 'skipped', due_date: '2026-09-01' }), TODAY)).toBe('upcoming');
  });

  it('reads a full timestamp as its calendar day instead of shifting a day back', () => {
    expect(deriveDoseStatus(dose({ status: 'due', due_date: '2026-10-01T00:00:00.000Z' }), TODAY)).toBe('due');
    expect(deriveDoseStatus(dose({ status: 'due', due_date: '2026-10-02T18:30:00.000Z' }), TODAY)).toBe('upcoming');
  });
});
