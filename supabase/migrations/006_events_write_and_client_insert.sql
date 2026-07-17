-- 006 event creation + client profile creation for management roles
--
-- Closes the loop so owner/admin/manager can actually create events and
-- onboard clients, not just read them.

create policy events_insert_management on events
  for insert
  to authenticated
  with check (is_org_management(organization_id));

create policy events_update_management on events
  for update
  to authenticated
  using (is_org_management(organization_id))
  with check (is_org_management(organization_id));

-- A management user creates a client_profiles row for an existing signed-up
-- user (same "they must have an account already" constraint as adding a
-- team member -- see organization_members_insert_bootstrap_or_admin).
create policy client_profiles_insert_management on client_profiles
  for insert
  to authenticated
  with check (is_org_management(organization_id));
