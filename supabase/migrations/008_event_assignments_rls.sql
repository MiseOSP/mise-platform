-- 008 event_assignments RLS
-- Management (owner/admin/manager) can view, create, and update chef assignments for
-- events in their own organization. Chefs can update ONLY their own assignment row to
-- accept/decline it; a trigger locks down every other field on that path so a chef can
-- never reassign themselves, change roles, or edit someone else's assignment.
-- Read access for chefs already flows through the chef_visible_events view (Document 14R,
-- migration 005), which runs with the view owner's privileges; these are the direct-table
-- policies needed for management visibility/writes and the chef accept/decline action.

create policy event_assignments_select_management on event_assignments
  for select
  to authenticated
  using (
    exists (
      select 1 from events e
      where e.id = event_assignments.event_id
        and is_org_management(e.organization_id)
    )
  );

create policy event_assignments_insert_management on event_assignments
  for insert
  to authenticated
  with check (
    exists (
      select 1 from events e
      where e.id = event_assignments.event_id
        and is_org_management(e.organization_id)
    )
    and exists (
      select 1 from chef_profiles cp
      join events e on e.id = event_assignments.event_id
      where cp.id = event_assignments.chef_id
        and cp.organization_id = e.organization_id
    )
  );

create policy event_assignments_update_management on event_assignments
  for update
  to authenticated
  using (
    exists (
      select 1 from events e
      where e.id = event_assignments.event_id
        and is_org_management(e.organization_id)
    )
  )
  with check (
    exists (
      select 1 from events e
      where e.id = event_assignments.event_id
        and is_org_management(e.organization_id)
    )
  );

create policy event_assignments_update_chef_self on event_assignments
  for update
  to authenticated
  using (
    chef_id in (select id from chef_profiles where user_id = app_user_id())
  )
  with check (
    chef_id in (select id from chef_profiles where user_id = app_user_id())
  );

-- Defense in depth: even though the policy above only lets a chef touch their own row,
-- restrict WHAT they can change on it. Management (checked first) may edit freely; a
-- non-management actor may only flip status to accepted/declined and stamp accepted_at --
-- event_id, chef_id, and role are frozen.
create or replace function event_assignments_guard_chef_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select e.organization_id into v_org from events e where e.id = new.event_id;

  if v_org is not null and is_org_management(v_org) then
    return new;
  end if;

  if new.event_id is distinct from old.event_id
     or new.chef_id is distinct from old.chef_id
     or new.role is distinct from old.role then
    raise exception 'Only status and accepted_at may be changed by the assigned chef.';
  end if;

  if new.status not in ('accepted', 'declined') then
    raise exception 'Chefs may only set status to accepted or declined.';
  end if;

  return new;
end;
$$;

drop trigger if exists event_assignments_guard_chef_update on event_assignments;
create trigger event_assignments_guard_chef_update
  before update on event_assignments
  for each row
  execute function event_assignments_guard_chef_update();
