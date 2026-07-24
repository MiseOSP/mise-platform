-- 035 event completion steps (spec S91/S102: chef "Mark required completion steps")
-- A per-event checklist of required completion/handoff steps. Management defines the
-- steps; the assigned chef marks each step done. This gives the Chef Portal a concrete
-- "mark required completion steps" surface without overloading event_assignments.completed_at.
--
-- Security (spec S51/S60/S65): RLS is the authorization boundary. Management has full
-- access within their org; a chef assigned to the event may read the steps and toggle
-- ONLY the completion fields on them. UI visibility is never authorization.

create table if not exists event_completion_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  event_id uuid not null references events(id),
  label text not null,
  sort_order integer not null default 0,
  completed_at timestamptz,
  completed_by uuid references chef_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists event_completion_steps_event_idx
  on event_completion_steps (event_id);

alter table event_completion_steps enable row level security;

-- Helper: is the current user a chef assigned to this event? (mirrors migration 019)
create or replace function is_chef_assigned_to_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from event_assignments ea
    where ea.event_id = target_event_id
      and ea.deleted_at is null
      and ea.chef_id in (select id from chef_profiles where user_id = app_user_id())
  );
$$;
grant execute on function is_chef_assigned_to_event(uuid) to authenticated;

-- Management (owner/admin) full access within their organization.
create policy event_completion_steps_manage on event_completion_steps
  for all
  to authenticated
  using (is_org_management(organization_id))
  with check (is_org_management(organization_id));

-- Assigned chef may read the steps for their event.
create policy event_completion_steps_select_chef on event_completion_steps
  for select
  to authenticated
  using (is_chef_assigned_to_event(event_id));

-- Assigned chef may update steps for their event (WHAT they may change is frozen
-- by the guard trigger below to just the completion fields).
create policy event_completion_steps_update_chef on event_completion_steps
  for update
  to authenticated
  using (is_chef_assigned_to_event(event_id))
  with check (is_chef_assigned_to_event(event_id));

-- Defense in depth: a non-management actor (an assigned chef) may only toggle the
-- completion fields. label, sort_order, event_id, organization_id are frozen so a
-- chef cannot rewrite the checklist or move a step to another event.
create or replace function event_completion_steps_guard_chef_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_org_management(new.organization_id) then
    return new;
  end if;
  if new.organization_id is distinct from old.organization_id
     or new.event_id is distinct from old.event_id
     or new.label is distinct from old.label
     or new.sort_order is distinct from old.sort_order
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'chefs may only mark completion, not edit the checklist';
  end if;
  new.completed_by := (select id from chef_profiles where user_id = app_user_id() limit 1);
  new.updated_at := now();
  return new;
end;
$$;

create trigger event_completion_steps_guard_chef_update_trg
  before update on event_completion_steps
  for each row execute function event_completion_steps_guard_chef_update();
