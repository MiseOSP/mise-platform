# ADR 0004: Reserve "Society" recurring-fee membership billing

- Status: Accepted, deferred implementation
- Date: 2026-07-22 (superseded earlier draft of same date)
- Deciders: Business owner (Nashville Chef Service)
- Related: ADR 0001 (Reserve no prepaid credits), ADR 0003 (configurable billing model,
  per_event activatable first), migration 022 (billing_model), migration 033
  (membership status transition + activation guard)

## Context

The Reserve product offers a recurring paid membership ("Society") that gives members
preferred pricing and benefits on events. This ADR records the OWNER'S product and
pricing decisions so they are not lost. Implementation (Stripe subscriptions, proration,
refund logic) is DEFERRED until after Phases 4 and 5. This record supersedes an earlier
draft that used a flat early-termination fee and a membership pause feature; both of those
ideas have been DROPPED in favor of the simpler model below.

Stripe note: Stripe charges no platform/subscription fee to us for offering subscriptions;
it is pay-per-transaction only (~2.9% + 30c per charge), and test mode is free.

## Decision

Two plans, deliberately kept simple so customers understand them immediately.

### Society Annual (flagship, default recommendation)
- Price: $299-349 / year (exact figure still to be finalized before build).
- Billed once, up front, for the year.
- Non-refundable after 30 days (unless a refund is required by law).
- No cancellation penalties: the commitment is already paid in full, so there is
  nothing to claw back after the refund window.

### Society Monthly
- Price: $29-39 / month (exact figure still to be finalized before build).
- Six-month initial commitment.
- After the six months, automatically converts to month-to-month.
- Cancel anytime after the initial term with 30 days' notice.

### Benefits-recovery clause (Annual 30-day window ONLY)
Because members receive preferred pricing, the 30-day Annual refund is not unconditional.
If an Annual member cancels within the 30-day window, Nashville Chef Service may reduce the
refund by the value of membership discounts and benefits already received during that
window. In practice the refund is: amount paid minus benefits already used, floored at zero.
This protects against someone joining, booking a heavily discounted large event, and
immediately requesting a full refund.

This clause applies ONLY during the Annual 30-day refund window. It does NOT apply to
Society Monthly (Monthly has no upfront refund to net against) and does NOT apply to
Annual after 30 days (non-refundable, so nothing to net).

### Dropped from earlier draft
- Early-termination fee: REMOVED. There is no flat cancellation fee on either plan.
- Membership pause (pause stops billing / extends term): REMOVED.

## Open items (to finalize before implementation)
- Exact Annual price within $299-349 and exact Monthly price within $29-39.
- Copy/legal review of the "unless required by law" and benefits-recovery language.
- Where benefits/discount value received is tracked so the Annual 30-day netting can be
  computed (likely derived from event_charges discount lines tied to the member's events).

## Consequences
- Server-authoritative billing: subscription state, refund eligibility, and the Annual
  30-day benefits-recovery netting must be enforced server-side (spec S51/S66), never
  trusted from the client. Webhooks signature-verified and idempotent (spec S66).
- billing_model 'recurring_fee' stays "coming soon" (ADR 0003) until this is built.
- Simpler than the prior draft: no pause state machine and no early-termination fee math
  to implement, reducing edge cases.
