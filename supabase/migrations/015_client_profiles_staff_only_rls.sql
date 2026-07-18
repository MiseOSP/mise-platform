-- 015: client_profiles_select_self_or_org_peer (005_events_and_profiles_rls.sql)
-- used shares_org_with(user_id), which is symmetric: it is true whenever the
-- viewer AND the target both have an active organization_members row in the
-- same org, regardless of role. Since clients are themselves organization_members
-- rows (role 'client'), this let any client read every OTHER client's profile
-- in the same organization -- including home address, allergies, dietary
-- preferences, and notes. That's a real PII leak between unrelated customers
-- of the same catering company.
--
-- Fix: replace it with a policy that only lets staff (owner/admin/manager/chef)
-- see the full client roster (preserving the existing client-roster/team
-- screen for management and chefs), while a client can only ever see their
-- own profile.

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
      and r.name <> 'client'
  );
$$;

grant execute on function is_org_staff(uuid) to authenticated;

drop policy if exists client_profiles_select_self_or_org_peer on client_profiles;

create policy client_profiles_select_self_or_staff on client_profiles
  for select
  to authenticated
  using (
    user_id = app_user_id()
    or is_org_staff(organization_id)
  );
