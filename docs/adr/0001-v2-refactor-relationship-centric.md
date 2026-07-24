# ADR 0001: v2.0 Refactor — Relationship-Centric Model, No Prepaid Credits, Expo-First Client

- Status: Accepted
- Date: 2026-07-21
- Supersedes drift introduced in: docs/04_database_schema.md (event-centric draft), migration 017 (prepaid service_credits)
- Governing spec: Mise Product & Engineering Specification v2.0 (Canonical Source of Truth)

## Context

The v2.0 specification shifts Mise from an event-centric model to a
relationship-centric model and introduces NCS Reserve (recurring memberships)
as the primary growth channel alongside four permanent Signature Experiences
(Gather, COAST, Brunch Society, Dinner Club).

A Phase Zero audit of the existing codebase found a solid multi-tenant
foundation (organization_members join table, roles-as-data, deleted_at
everywhere, partitioned audit_logs, RLS helpers, Stripe webhook idempotency)
but three material points of drift from v2.0:

1. No Relationship entity. Client identity lives on client_profiles tied
   1:1 to a user, and events.client_id points at it. v2.0 (Sections 9, 16,
   19) makes the Relationship the enduring record, created at first inquiry,
   possibly before any account exists.
2. Reserve assumes prepaid service credits (migration 017). v2.0 Section 15
   states the architecture must not assume prepaid event credits unless that
   decision is explicitly adopted.
3. Flat event financials (service_fee / food_cost) rather than the required
   line-item ledger with per-category deposit eligibility (v2.0 Sections 14,
   15, 25).

## Decisions

1. Refactor, not restart. The foundation is reconcilable; we layer the new
   model on top incrementally (v2.0 Section 85).

2. Introduce a relationship-centric layer: relationships,
   relationship_contacts, relationship_addresses, relationship_preferences,
   dietary_requirements. Events and memberships attach to a Relationship. An
   inquiry creates a Relationship with no account required.

3. Reserve billing model: NO prepaid credits. The Reserve platform is free to
   access and explore. Money is collected only when an actual event is booked.
   Reserve schema is reworked to be billing-model-agnostic: membership_plans
   carries a configurable billing_model, and the service_credits table is
   retired. This is a product owner decision recorded here per v2.0 Section 96.

4. Financial ledger: replace flat event fees with an event_charges line-item
   ledger. Deposit eligibility is a per-line property. For the Nashville
   pilot, only service and fixed_add_on charges are deposit-eligible; deposit
   = 50% of (service subtotal + fixed add-ons). Groceries, rentals, taxes, and
   adjustments are excluded from the deposit.

5. Client surface: Expo (web + native) owns the client experience for the MVP.
   A separate Next.js admin app is deferred to avoid duplicate client flows
   (v2.0 Sections 46, 50). Revisit when admin needs outgrow Expo.

## Consequences

- New migrations (021+) add the relationship layer, rework Reserve, and add
  the charge ledger. Existing tables are altered non-destructively; data is
  empty (dev), so backfill is trivial.
- Money is stored as integer minor units going forward (v2.0 Section 56);
  legacy numeric columns are migrated in the ledger work.
- service_credits and recurring prepaid assumptions are removed from the
  domain layer.
