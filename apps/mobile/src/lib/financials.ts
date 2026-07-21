import { supabase } from './supabase';

// Financial domain layer (v2.0 Sections 14, 15, 25, 51, 56).
//
// IMPORTANT: The SERVER is the source of truth for money. The database view
// event_financial_summary computes authoritative totals, deposit due, and
// balance. The client must never be trusted to compute a final total or
// deposit that gets charged (v2.0 Section 51). The pure helpers below exist
// only for OPTIMISTIC DISPLAY while building an estimate and are written to
// exactly mirror the server rule so the two never disagree.
//
// All money is in integer minor units (cents). Never use floats for money.

export type ChargeCategory =
  | 'service'
  | 'fixed_add_on'
  | 'grocery_estimate'
  | 'grocery_actual'
  | 'rental'
  | 'tax'
  | 'adjustment'
  | 'discount'
  | 'gratuity';

export type EventCharge = {
  category: ChargeCategory;
  amountCents: number; // discounts are negative
  depositEligible: boolean;
};

// Locked Nashville pilot rule (ADR 0001): only 'service' and 'fixed_add_on'
// are deposit-eligible. This is the single client-side definition of that set.
export const DEPOSIT_ELIGIBLE_CATEGORIES: ReadonlySet<ChargeCategory> = new Set([
  'service',
  'fixed_add_on',
]);

export function isDepositEligible(category: ChargeCategory): boolean {
  return DEPOSIT_ELIGIBLE_CATEGORIES.has(category);
}

// Sum of every non-deleted charge (discounts subtract).
export function totalCents(charges: EventCharge[]): number {
  return charges.reduce((sum, c) => sum + c.amountCents, 0);
}

// Base for the deposit = sum of deposit-eligible charges only.
export function depositBaseCents(charges: EventCharge[]): number {
  return charges
    .filter((c) => c.depositEligible)
    .reduce((sum, c) => sum + c.amountCents, 0);
}

// Deposit = 50% of the eligible base. Integer-safe: floor(base / 2), matching
// the server view's integer division. Groceries, rentals, taxes, and
// adjustments are excluded because they are not deposit-eligible.
export function depositDueCents(charges: EventCharge[]): number {
  return Math.floor(depositBaseCents(charges) / 2);
}

export function formatMoney(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

// Authoritative read from the server view. Use this for anything the client
// relies on (confirmation screens, balances), NOT the local helpers above.
export type EventFinancialSummary = {
  eventId: string;
  totalCents: number;
  depositBaseCents: number;
  depositDueCents: number;
  paidCents: number;
  refundedCents: number;
  balanceCents: number;
};

export async function fetchEventFinancialSummary(
  eventId: string,
): Promise<{ data: EventFinancialSummary | null; error: string | null }> {
  const { data, error } = await supabase
    .from('event_financial_summary')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  const total = Number(data.total_cents ?? 0);
  const paid = Number(data.paid_cents ?? 0);
  const refunded = Number(data.refunded_cents ?? 0);

  return {
    data: {
      eventId: data.event_id as string,
      totalCents: total,
      depositBaseCents: Number(data.deposit_base_cents ?? 0),
      depositDueCents: Number(data.deposit_due_cents ?? 0),
      paidCents: paid,
      refundedCents: refunded,
      // balance = total - (paid - refunded)
      balanceCents: total - (paid - refunded),
    },
    error: null,
  };
}
