# ADR 0003: Reserve Billing Model — Configurable, Per-Event First

- Status: Accepted
- Date: 2026-07-21
- Governing spec: Mise Product & Engineering Specification v2.0 (Sections 7, 10, 14, 15, 20, 39, 51, 72, 89, 105)
- Builds on: ADR 0001 (relationship-centric refactor), migration 022 (reserve_no_credits)

## Context

Section 105 lists as an OPEN DECISION whether Reserve billing is a fixed
membership fee, a scheduled service charge, or a hybrid. Section 15 forbids
assuming Reserve uses prepaid credits unless explicitly adopted, and Section 96
forbids an engineer silently resolving an open business decision in code.

Migration 022 already made membership_plans billing-model-agnostic via a
billing_model column accepting per_event, recurring_fee, or hybrid, defaulting
to per_event, plus recurring_fee_cents and recurring_fee_interval placeholders.

Three models were weighed with the product owner:

1. per_event: membership is free to hold; money is collected only when an actual
Event is booked, reusing the existing deposit/final-payment ledger. Simplest,
zero billing risk, but no predictable recurring revenue.
2. recurring_fee: a flat fee on a cadence via Stripe subscriptions. True MRR
(Sections 7, 72) but the most complex: dunning, proration, pause handling,
webhook idempotency (Section 66), and needs the still-open cancellation and
refund policy (Section 105).
3. hybrid: a smaller recurring fee plus per-event charges. Balances both goals
but requires both engines and is hardest to explain in a pilot.

## Decisions

1. Reserve billing is CONFIGURABLE per plan via membership_plans.billing_model.
No single model is hard-coded. This keeps Section 105 honest.

2. For the Nashville MVP the only ACTIVATABLE billing path is per_event. It
reuses the event ledger (migration 023) and Stripe deposit flow already built,
so Reserve carries zero new billing risk and no charge can occur for service
not delivered (Section 15).

3. recurring_fee and hybrid remain SELECTABLE on a plan but are treated as
"coming soon": the data layer and UI surface them as not-yet-activatable. They
will be turned on deliberately once the pause/cancel/refund policy (Section 105)
is settled and Stripe subscription handling (Section 66) is built. This is the
least-destructive, most-configurable temporary implementation Section 94
requires.

4. Membership activation (draft/proposed -> active) is an admin-authorized,
server-enforced transition (Section 51: membership activation must not be
client-decided). A DB function/guard enforces the allowed transitions rather
than trusting the client.

## Consequences

- No schema change is required for the billing choice itself; migration 022
already carries billing_model. A new migration adds only the server-side
activation guard and any billing-foundation columns needed for per_event.
- The member dashboard (Section 39) shows billing status derived from event
payments for per_event plans, not a subscription balance.
- One-time-to-Reserve conversion is tracked so Section 72 metrics remain
possible without committing to recurring_fee now.
- When recurring_fee/hybrid are later activated, this ADR is superseded by a
follow-up ADR that documents the Stripe subscription + policy decisions.
