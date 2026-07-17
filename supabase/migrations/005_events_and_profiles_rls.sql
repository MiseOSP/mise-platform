-- 005 events access control + chef/client profile visibility
--
-- 001_init.sql's original `org_isolation` policy on events allowed ANY org
-- member (including chefs and clients) to select full rows directly from
-- the base `events` table -- unmasked address, internal_notes, financial
-- fields, and every other client's events. That defeats the purpose of the
-- chef_visible_events view (Document 14R's "hide address until 15 hours
-- before event" rule) and leaks cross-client data. This migration tightens
-- that down properly:
--   - owner/admin/manager: full access to all events in their org
--   - client: only their own events (full detail -- it's their own data)
--   - chef: NO direct access to the base `events` table at all. They must
--     go through chef_visible_events, which is redefined below to (a) only
--     include events they're assigned to and (b) only expose a curated,
--     masked column set.

drop policy if exists org_isolation on events;

create or replace function is_org_management(target_org uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from organization_members om
    join roles r on r.id = om.role_id
    where om.organization_id = target_org
      and om.user_id = app_user_id()
      and om.status = 'active'
      and om.deleted_at is null
      and r.name in ('owner', 'admin', 'manager')
  )
$$;

grant execute on function is_org_management(uuid) to authenticated;

create policy events_select_management on events
  for select
  to authenticated
  using (is_org_management(organization_id));

create policy events_select_client_own on events
  for select
  to authenticated
  using (
    client_id in (select id from client_profiles where user_id = app_user_id())
  );

-- chef_profiles / client_profiles: org peers (e.g. admins building the Team
-- or Events screens) and the profile owner may read; only the owner writes.
create policy chef_profiles_select_self_or_org_peer on chef_profiles
  for select
  to authenticated
  using (user_id = app_user_id() or shares_org_with(user_id));

create policy chef_profiles_update_self on chef_profiles
  for update
  to authenticated
  using (user_id = app_user_id())
  with check (user_id = app_user_id());

create policy client_profiles_select_self_or_org_peer on client_profiles
  for select
  to authenticated
  using (user_id = app_user_id() or shares_org_with(user_id));

create policy client_profiles_update_self on client_profiles
  for update
  to authenticated
  using (user_id = app_user_id())
  with check (user_id = app_user_id());

-- Redefine chef_visible_events: curated column set (no internal_notes, no
-- financial fields, no client contact details beyond what's needed) and
-- filtered to only events the calling chef is actually assigned to. This
-- view intentionally does NOT use security_invoker, so it runs with the
-- view owner's privileges and can read the base `events` table even though
-- chefs have no direct SELECT policy on it -- the filtering below (via
-- app_user_id(), evaluated per calling user) is what keeps this safe.
drop view if exists chef_visible_events;

create view chef_visible_events as
select
  e.id,
  e.organization_id,
  e.status,
  e.event_date,
  e.start_time,
  e.guest_count,
  e.occasion,
  e.city,
  e.state,
  case
    when now() >= (e.event_date::timestamptz + e.start_time - interval '15 hours')
    then e.address
    else null
  end as visible_address,
  ea.id as assignment_id,
  ea.role as assignment_role,
  ea.status as assignment_status
from events e
join event_assignments ea
  on ea.event_id = e.id
  and ea.deleted_at is null
where ea.chef_id in (
  select id from chef_profiles where user_id = app_user_id()
);

grant select on chef_visible_events to authenticated;
