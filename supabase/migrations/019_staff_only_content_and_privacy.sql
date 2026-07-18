-- 019 restrict content library + client/staff PII to staff only (not clients)
--
-- Two gaps found while testing the client role end-to-end:
-- 1. resources/ingredients/recipes/recipe_ingredients used is_org_member for
--    SELECT, meaning a client (any active org member) could read the
--    internal kitchen content library -- recipes, prep resources,
--    ingredient list -- via the app (Library tab) or direct API calls, even
--    though only management could edit it.
-- 2. client_profiles used shares_org_with(user_id) for SELECT, meaning any
--    org member -- including another client -- could read every OTHER
--    client's address, dietary preferences, allergies, notes, and
--    lifetime_value. organization_members had the same over-broad shape:
--    any member could list the entire roster (every staff + client email).
-- This migration adds an is_org_staff() helper (owner/admin/manager/chef --
-- i.e. everyone except client) and re-scopes those policies. client_profiles
-- keeps chef visibility, but only for clients the chef actually has an
-- event assignment with (mirrors the existing chef_visible_events pattern).

create or replace function is_org_staff(target_org uuid)
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
      and r.name in ('owner', 'admin', 'manager', 'chef')
  )
$$;

grant execute on function is_org_staff(uuid) to authenticated;

-- content library: staff only, not clients
drop policy if exists resources_select_members on resources;
create policy resources_select_staff on resources
for select
using (is_org_staff(organization_id) and deleted_at is null);

drop policy if exists ingredients_select_members on ingredients;
create policy ingredients_select_staff on ingredients
for select
using (is_org_staff(organization_id));

drop policy if exists recipes_select_members on recipes;
create policy recipes_select_staff on recipes
for select
using (is_org_staff(organization_id));

drop policy if exists recipe_ingredients_select_members on recipe_ingredients;
create policy recipe_ingredients_select_staff on recipe_ingredients
for select
using (
  exists (
    select 1 from recipes r
    where r.id = recipe_ingredients.recipe_id
    and is_org_staff(r.organization_id)
  )
);

-- client_profiles: self, management, or the chef assigned to that client's event
drop policy if exists client_profiles_select_self_or_org_peer on client_profiles;
create policy client_profiles_select_self_mgmt_or_assigned_chef on client_profiles
for select
to authenticated
using (
  user_id = app_user_id()
  or is_org_management(organization_id)
  or exists (
    select 1 from event_assignments ea
    join events e on e.id = ea.event_id
    where e.client_id = client_profiles.id
    and ea.deleted_at is null
    and ea.chef_id in (select id from chef_profiles where user_id = app_user_id())
  )
);

-- organization_members: self, or management (team roster); chefs/clients no
-- longer get a blanket roster read of every member's email.
drop policy if exists organization_members_select_member on organization_members;
create policy organization_members_select_self_or_management on organization_members
for select
using (
  user_id = app_user_id()
  or is_org_management(organization_id)
);
