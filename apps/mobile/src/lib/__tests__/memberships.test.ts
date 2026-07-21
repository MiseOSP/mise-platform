import { describe, it, expect, vi } from 'vitest';

// memberships.ts transitively imports ./supabase (native storage), which throws
// under the node test env. We only test the pure date helper here, so stub it.
vi.mock('../supabase', () => ({ supabase: {} }));

import { nextOccurrenceOnOrAfter } from '../memberships';

describe('nextOccurrenceOnOrAfter', () => {
  // 2026-07-21 is a Tuesday (weekday 2).
  it('returns the same date when the weekday already matches', () => {
    expect(nextOccurrenceOnOrAfter('2026-07-21', 2)).toBe('2026-07-21');
  });

  it('advances to the next matching weekday later in the same week', () => {
    // Tuesday -> Friday (5) is +3 days.
    expect(nextOccurrenceOnOrAfter('2026-07-21', 5)).toBe('2026-07-24');
  });

  it('wraps into the following week when the weekday has passed', () => {
    // Tuesday -> Monday (1) is +6 days.
    expect(nextOccurrenceOnOrAfter('2026-07-21', 1)).toBe('2026-07-27');
  });

  it('handles Sunday (0) as a target', () => {
    // Tuesday -> Sunday is +5 days.
    expect(nextOccurrenceOnOrAfter('2026-07-21', 0)).toBe('2026-07-26');
  });

  it('crosses a month boundary correctly', () => {
    // 2026-07-30 is a Thursday (4); next Monday (1) is 2026-08-03.
    expect(nextOccurrenceOnOrAfter('2026-07-30', 1)).toBe('2026-08-03');
  });

  it('crosses a year boundary correctly', () => {
    // 2026-12-31 is a Thursday (4); next Saturday (6) is 2027-01-02.
    expect(nextOccurrenceOnOrAfter('2026-12-31', 6)).toBe('2027-01-02');
  });
});
