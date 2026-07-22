-- 031 reserve interests: widen staff write access from admin to all staff
--
-- Migration 022 created reserve_interests_manage_staff as an ADMIN-only write
-- policy (is_org_admin = owner/admin). Product decision: any staff member of
-- the organization (owner/admin/manager/chef) may manage reserve interests --
-- e.g. a chef adds or edits notes during a consult. is_org_staff (defined in
-- 015_client_profiles_staff_only_rls.sql) matches any active organization
-- member regardless of role name, which is exactly the "all staff" grant.
--
-- We drop and recreate the FOR ALL policy so staff-initiated
-- insert/update/delete are permitted. Client self-service policies (029/030)
-- are unaffected; this only broadens the staff-side grant.

drop policy if exists reserve_interests_manage_staff on reserve_interests;

create policy reserve_interests_manage_staff on reserve_interests
  for all
  to authenticated
  using (is_org_staff(organization_id))
  with check (is_org_staff(organization_id));
