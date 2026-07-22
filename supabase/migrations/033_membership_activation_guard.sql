-- 033 Reserve billing foundation + server-side activation guard
-- Governing: v2.0 Sections 20, 39, 51, 89, 105; ADR 0003.
--
-- Section 51 requires membership activation to be server-enforced, never
-- client-decided. ADR 0003 makes billing_model configurable but allows only
-- per_event to be ACTIVATED in the Nashville MVP; recurring_fee/hybrid are
-- selectable-but-"coming soon". This migration adds:
--   1. a validated membership status-transition guard (trigger)
--   2. an activation gate that blocks activating a non-per_event plan for now
--   3. conversion tracking: activating a membership flips the relationship's
--      client_status to 'member' (Section 72 one-time-to-Reserve metric)
-- No new billing engine: per_event money flows through the existing event
-- ledger (migration 023). recurring_fee_cents/interval stay dormant.

-- 1. Allowed status transitions -------------------------------------------
-- draft      -> proposed, canceled
-- proposed   -> active, canceled
-- active     -> paused, past_due, canceled, completed
-- paused     -> active, canceled, completed
-- past_due   -> active, canceled, completed
-- canceled   -> (terminal)
-- completed  -> (terminal)
create or replace function enforce_membership_transition()
returns trigger
language plpgsql
as $$
declare
  old_status text := old.status;
  new_status text := new.status;
  plan_billing_model text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new_status = old_status then
    return new;
  end if;

  -- Validate the transition graph.
  if not (
    (old_status = 'draft'    and new_status in ('proposed','canceled'))
 or (old_status = 'proposed' and new_status in ('active','canceled'))
 or (old_status = 'active'   and new_status in ('paused','past_due','canceled','completed'))
 or (old_status = 'paused'   and new_status in ('active','canceled','completed'))
 or (old_status = 'past_due' and new_status in ('active','canceled','completed'))
  ) then
    raise exception 'Illegal membership status transition: % -> %', old_status, new_status;
  end if;

  -- Activation gate: only per_event plans may become active in the MVP (ADR 0003).
  if new_status = 'active' then
    select mp.billing_model into plan_billing_model
      from membership_plans mp
     where mp.id = new.plan_id;

    if plan_billing_model is distinct from 'per_event' then
      raise exception
        'Only per_event plans can be activated in this release (plan billing_model=%). See ADR 0003.',
        plan_billing_model;
    end if;

    if new.start_date is null then
      new.start_date := current_date;
    end if;
  end if;

  -- Stamp pause/cancel timestamps for auditability (Section 20/55).
  if new_status = 'paused' and new.paused_at is null then
    new.paused_at := now();
  end if;
  if new_status = 'canceled' and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_membership_transition on memberships;
create trigger trg_membership_transition
  before update on memberships
  for each row execute function enforce_membership_transition();

-- 2. Conversion tracking ---------------------------------------------------
-- When a membership reaches 'active', mark its relationship a 'member'.
-- Runs AFTER so the row is committed to its new status first.
create or replace function mark_relationship_member_on_activation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'active'
     and old.status is distinct from 'active'
     and new.relationship_id is not null then
    update relationships
       set client_status = 'member',
           updated_at = now()
     where id = new.relationship_id
       and client_status is distinct from 'member';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_membership_conversion on memberships;
create trigger trg_membership_conversion
  after update on memberships
  for each row execute function mark_relationship_member_on_activation();

-- 3. Membership change requests -------------------------------------------
-- Section 39: pause and scheduling-change requests route to an admin rather
-- than mutating the recurring schedule directly. A member (or admin on their
-- behalf) files a request; an admin resolves it. This does NOT change the
-- membership until an admin acts.
create table membership_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  membership_id uuid not null references memberships(id),
  request_type text not null
    check (request_type in ('pause','resume','reschedule','cancel','concierge','other')),
  message text,
  status text not null default 'open'
    check (status in ('open','in_review','resolved','declined')),
  requested_by uuid references users(id),
  resolved_by uuid references users(id),
  resolved_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on membership_change_requests (organization_id);
create index on membership_change_requests (membership_id);
create index on membership_change_requests (status);

alter table membership_change_requests enable row level security;

-- A member may see and create requests for their own membership.
create policy membership_change_requests_select_self on membership_change_requests
for select to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from memberships m
    join client_profiles cp on cp.id = m.client_id
    where m.id = membership_change_requests.membership_id
      and cp.user_id = app_user_id()
  )
);

create policy membership_change_requests_insert_self on membership_change_requests
for insert to authenticated
with check (
  exists (
    select 1 from memberships m
    join client_profiles cp on cp.id = m.client_id
    where m.id = membership_change_requests.membership_id
      and cp.user_id = app_user_id()
  )
);

-- Staff may read; admins may manage (resolve/decline).
create policy membership_change_requests_select_staff on membership_change_requests
for select to authenticated
using (is_org_member(organization_id));

create policy membership_change_requests_manage_admin on membership_change_requests
for all to authenticated
using (is_org_admin(organization_id))
with check (is_org_admin(organization_id));
