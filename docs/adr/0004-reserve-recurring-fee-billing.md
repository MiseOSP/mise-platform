# ADR 0004: Reserve Recurring-Fee Billing (Society Membership)

- Status: Accepted, deferred implementation
- Date: 2026-07-21
- Decision owner: Product owner (founder)
- Governing spec: Mise Product & Engineering Specification v2.0 (Sections 7, 14, 15, 20, 39, 51, 66, 72, 89, 105)
- Supersedes (on implementation): ADR 0003's "per_event only" activation gate
- Builds on: ADR 0003 (configurable billing_model), migration 033 (activation guard)

## Status note

This ADR RECORDS an approved business decision. Implementation is intentionally
DEFERRED until after Phase 4 (Admin Operations) and Phase 5 (Chef Portal). It is
written now so the pricing and policy decisions are captured and not lost. When
implementation begins, this ADR is promoted and the migration 033 activation
gate is relaxed to allow recurring_fee activation.

## Context

The product owner has decided Reserve launches as a "Society" recurring
membership billed as a flat fee on a cadence (the recurring_fee model from
ADR 0003), not per_event. Section 105 listed this billing choice and the
pause/cancel/refund policy as open decisions; this ADR resolves them.

## Decisions

### 1. Plans and pricing (Society membership)

- Society Annual (flagship, DEFAULT recommendation): USD 299-349 per year,
  billed up front. Preferred because it matches how often clients entertain,
  avoids another monthly subscription, and improves cash flow.
- Society Monthly: USD 29-39 per month for clients preferring lower upfront
  cost.
- Exact final price points within these ranges to be set on the plan record at
  configuration time (configurable, not hard-coded).

### 2. Minimum commitment

- A 6-month minimum commitment applies to BOTH plans (monthly and annual).
- Enforcement mechanism: EARLY TERMINATION FEE (not a hard cancel block).
  Clients may cancel at any time, but cancellation before the 6-month term
  completes triggers an early termination fee.

### 3. Cancellation and refund policy

- Cancel BEFORE the 6-month term:
  - An early cancellation (termination) fee is applied.
  - The remaining balance is then prorated (refund of the unused prorated
    portion for annual; monthly stops future billing).
- Cancel AFTER the 6-month term:
  - No cancellation fee.
  - Client receives a prorated refund of the unused portion (relevant for the
    annual plan paid up front).

### 4. Pause behavior

- Pausing a membership STOPS billing temporarily (billing does not accrue while
  paused). The term is effectively extended by the pause duration.
- If a client CANCELS following a pause, the early termination fee still applies
  if they are still within the 6-month minimum commitment (the pause does not
  waive the minimum).

### 5. Exact early-termination-fee amount

- OPEN: the specific fee amount/formula (flat vs. remaining-months-based) is not
  yet fixed. To be set configurably on the plan before public launch. Marked
  clearly pending per Section 105; must not be silently chosen by an engineer.

## Implementation outline (for when this is promoted)

- New ADR-driven migration: add stripe subscription linkage to memberships
  (stripe_subscription_id, stripe_customer_id, current_period_end,
  minimum_commitment_end_date, early_termination_fee_cents), and relax the
  migration 033 activation gate to permit recurring_fee.
- Stripe test mode first (no Stripe platform subscription fee; Stripe is
  pay-per-transaction only). Create Stripe Products/Prices for annual + monthly.
- Payment method collected via Stripe hosted flow only; Mise never stores card
  data (Section 66). No card numbers typed by any agent.
- Stripe webhook (signature-verified, idempotent per Section 66) updates
  membership status: active -> past_due on failed renewal -> canceled; handles
  invoice.paid, invoice.payment_failed, customer.subscription.deleted.
- Server-enforced (Section 51): activation, cancellation, fee calculation,
  proration, and refund authority live in trusted server/DB functions, never
  the client.
- Audit (Section 55): membership activation, pause, cancel, and refund events
  are audit-logged.

## Consequences

- Until promoted, ADR 0003 remains in force: only per_event memberships can be
  activated. Society plans may be created but not yet activated.
- This is the single largest and most money-sensitive Reserve component and is
  scheduled as its own focused, well-tested workstream after Phases 4 and 5.
