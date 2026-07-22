-- 034_chef_visible_dietary.sql
--
-- Phase 5 / spec S68: critical dietary and allergy information must be
-- prominent in the chef's view. The chef-safe `chef_visible_events` view
-- (last defined in 005_events_and_profiles_rls.sql) intentionally exposes a
-- curated, address-masked column set. It did NOT include the event's dietary
-- fields, so an assigned chef could not see dietary/allergy requirements in
-- app. This migration redefines the view to add the two dietary text columns
-- that already exist on `events` (dietary_preferences from 001_init.sql,
-- dietary_statement from 025_public_experience_discovery.sql).
--
-- Scope of exposure is unchanged: the WHERE clause still restricts rows to the
-- calling chef's own assignments (via app_user_id()), address is still gated to
-- ~15 hours before service, and no internal notes are exposed. This only widens
-- the column list by the dietary fields, which service staff need (spec S68).
-- Security remains server-enforced (spec S51/S60/S65); the mobile UI change is
-- separate.

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
  e.dietary_preferences,
  e.dietary_statement,
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
