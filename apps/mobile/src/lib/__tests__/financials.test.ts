import { describe, expect, it, vi } from 'vitest';

// financials.ts imports the supabase client at module load. The pure helpers
// under test never touch it, but importing the real client boots React Native
// AsyncStorage (which needs 'window'). Stub it so the unit tests stay pure.
vi.mock('../supabase', () => ({ supabase: {} }));
import {
  isDepositEligible,
  totalCents,
  depositBaseCents,
  depositDueCents,
  formatMoney,
  type EventCharge,
} from '../financials';

// Helper to build a charge with sensible defaults.
function charge(over: Partial<EventCharge>): EventCharge {
  return { category: 'service', amountCents: 0, depositEligible: false, ...over };
}

describe('isDepositEligible', () => {
  it('is true only for service and fixed_add_on (ADR 0001)', () => {
    expect(isDepositEligible('service')).toBe(true);
    expect(isDepositEligible('fixed_add_on')).toBe(true);
  });

  it('is false for every non-eligible category', () => {
    for (const c of [
      'grocery_estimate',
      'grocery_actual',
      'rental',
      'tax',
      'adjustment',
      'discount',
      'gratuity',
    ] as const) {
      expect(isDepositEligible(c)).toBe(false);
    }
  });
});

describe('totalCents', () => {
  it('sums all charges, with discounts subtracting (negative amounts)', () => {
    const charges = [
      charge({ category: 'service', amountCents: 50000 }),
      charge({ category: 'rental', amountCents: 10000 }),
      charge({ category: 'discount', amountCents: -5000 }),
    ];
    expect(totalCents(charges)).toBe(55000);
  });

  it('is zero for an empty charge list', () => {
    expect(totalCents([])).toBe(0);
  });
});

describe('depositBaseCents', () => {
  it('sums only deposit-eligible charges', () => {
    const charges = [
      charge({ category: 'service', amountCents: 40000, depositEligible: true }),
      charge({ category: 'fixed_add_on', amountCents: 20000, depositEligible: true }),
      charge({ category: 'rental', amountCents: 15000, depositEligible: false }),
      charge({ category: 'tax', amountCents: 5000, depositEligible: false }),
    ];
    expect(depositBaseCents(charges)).toBe(60000);
  });

  it('ignores non-eligible charges entirely', () => {
    const charges = [
      charge({ category: 'grocery_estimate', amountCents: 30000, depositEligible: false }),
    ];
    expect(depositBaseCents(charges)).toBe(0);
  });
});

describe('depositDueCents', () => {
  it('is 50% of the eligible base', () => {
    const charges = [
      charge({ category: 'service', amountCents: 40000, depositEligible: true }),
    ];
    expect(depositDueCents(charges)).toBe(20000);
  });

  it('floors odd amounts (integer-safe, matches server view)', () => {
    const charges = [
      charge({ category: 'service', amountCents: 40001, depositEligible: true }),
    ];
    // floor(40001 / 2) = 20000, never 20000.5
    expect(depositDueCents(charges)).toBe(20000);
  });

  it('excludes non-eligible charges from the deposit', () => {
    const charges = [
      charge({ category: 'service', amountCents: 40000, depositEligible: true }),
      charge({ category: 'rental', amountCents: 100000, depositEligible: false }),
      charge({ category: 'tax', amountCents: 8000, depositEligible: false }),
    ];
    // Only the 40000 service charge counts: floor(40000/2) = 20000
    expect(depositDueCents(charges)).toBe(20000);
  });
});

describe('formatMoney', () => {
  it('formats cents as USD by default', () => {
    expect(formatMoney(123456)).toBe('$1,234.56');
  });

  it('formats zero cleanly', () => {
    expect(formatMoney(0)).toBe('$0.00');
  });
});
