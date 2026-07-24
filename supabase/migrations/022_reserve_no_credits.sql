-- 022 Reserve rework: remove prepaid credits, make billing model-agnostic
-- Product decision (ADR 0001, v2.0 Section 15 & 96): NCS Reserve does NOT use
-- prepaid service credits. The Reserve platform is free to access and explore;
-- money is collected only when an actual event is booked. This migration:
--   * retires service_credits (drops the table and the event links to it)
--   * makes membership_plans billing-model-agnostic (billing_model column)
--   * re-points memberships at relationships (the enduring client record)
--   * keeps recurring_schedules for cadence, but they only PROPOSE events;
--     they never auto-charge.
-- Dev database is empty, so drops are safe and no backfill is required.

-- 1. Drop the prepaid-credit machinery -----------------------------------
alter table events drop column if exists service_credit_id;
drop table if exists service_credits;

-- 2. Make membership_plans billing-model-agnostic ------------------------
-- Remove credit-specific columns and the old billing_frequency check that
-- assumed a fixed set of prepaid cadences.
alter table membership_plans drop column if exists included_credits;
alter table membership_plans drop column if exists credit_expiration_days;

alter table membership_plans
  add column if not exists billing_model text not null default 'per_event'
    check (billing_model in ('per_event','recurring_fee','hybrid'));

-- 'per_event'     : no recurring charge; client pays when each event is booked
-- 'recurring_fee' : a flat membership fee on a cadence (configured later)
-- 'hybrid'        : a recurring fee plus per-event charges
-- For the Nashville pilot the default and only supported value is 'per_event'.

alter table membership_plans
  add column if not exists recurring_fee_cents bigint not null default 0;
alter table membership_plans
  add column if not exists recurring_fee_interval text
    check (recurring_fee_interval in ('weekly','biweekly','monthly','quarterly'));

-- base_price was an ambiguous numeric; keep it nullable for reference pricing
-- but money that is actually charged lives in the event ledger (migration 023).

-- 3. Re-point memberships at relationships -------------------------------
alter table memberships
  add column if not exists relationship_id uuid references relationships(id);
create index if not exists memberships_relationship_id_idx
  on memberships (relationship_id);

-- Broaden membership status to match v2.0 Section 20. Drop the old narrow
-- check constraint and add the fuller lifecycle. (Constraint name is the
-- Postgres default: <table>_<column>_check.)
alter table memberships drop constraint if exists memberships_status_check;
alter table memberships
  add constraint memberships_status_check
  check (status in ('draft','proposed','active','paused','past_due','canceled','completed'));

-- 4. Reserve interest: a lightweight lead capture that does NOT create a
-- membership or any charge. Section 39/89 — interest routes to an admin.
create table reserve_interests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  relationship_id uuid references relationships(id),
  desired_cadence text,
  preferred_day_of_week smallint check (preferred_day_of_week between 0 and 6),
  notes text,
  status text not null default 'new'
    check (status in ('new','contacted','consult_scheduled','converted','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on reserve_interests (organization_id);
create index on reserve_interests (relationship_id);
create index on reserve_interests (status);

alter table reserve_interests enable row level security;

create policy reserve_interests_select_staff on reserve_interests
  for select to authenticated
  using (is_org_member(organization_id) and deleted_at is null);

create policy reserve_interests_select_self on reserve_interests
  for select to authenticated
  using (
    deleted_at is null
    and relationship_id is not null
    and can_read_relationship(relationship_id)
  );

create policy reserve_interests_manage_staff on reserve_interests
  for all to authenticated
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));
