-- 034 Chef-visible event + dietary views (v2 relationship-centric)
-- Spec v2.0 Section 67 (expose only what's needed) and Section 68
-- (distinguish preference / intolerance / allergy; need-to-know).
-- A chef sees an event only if assigned to it via event_assignments.
-- Dietary data lives in dietary_requirements, reached through the
-- event's client_profile -> relationship. It is NOT a column on events.

-- View 1: events a chef is assigned to, with need-to-know fields only.
-- Address is withheld until 15 hours before the event start.
drop view if exists chef_visible_events;
create view chef_visible_events as
select
  e.id as event_id,
  e.organization_id,
  e.occasion,
  e.city,
  e.state,
  e.event_date,
  e.start_time,
  e.guest_count,
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
where e.deleted_at is null
  and ea.chef_id in (
    select id from chef_profiles where user_id = app_user_id()
  );

grant select on chef_visible_events to authenticated;

-- View 2: dietary requirements for events the chef is assigned to.
-- Reached via events.client_id -> client_profiles.relationship_id
-- -> dietary_requirements.relationship_id. Each client_profile links
-- to at most one relationship (single relationship_id column), so a
-- chef only ever sees dietary rows for their assigned event's client.
-- Section 68: expose kind, label, severity, notes so preferences,
-- intolerances and allergies are clearly distinguished.
drop view if exists chef_visible_dietary;
create view chef_visible_dietary as
select
  e.id as event_id,
  dr.id as dietary_id,
  dr.kind,
  dr.label,
  dr.severity,
  dr.notes
from events e
join event_assignments ea
  on ea.event_id = e.id
  and ea.deleted_at is null
join client_profiles cp
  on cp.id = e.client_id
join dietary_requirements dr
  on dr.relationship_id = cp.relationship_id
  and dr.deleted_at is null
where e.deleted_at is null
  and cp.relationship_id is not null
  and ea.chef_id in (
    select id from chef_profiles where user_id = app_user_id()
  );

grant select on chef_visible_dietary to authenticated;
