-- 007 chef self-service profile creation
--
-- Gap found while wiring up the Events flow: chef_profiles had select/update
-- policies but no INSERT policy. An owner/admin adding someone as a "chef"
-- (via organization_members) had no way for that chef to then create their
-- own chef_profiles row (bio, specialties, etc.) -- same class of bug as
-- the events/client_profiles write gap fixed in 006.
create policy chef_profiles_insert_self on chef_profiles
  for insert
  to authenticated
  with check (
    user_id = app_user_id()
    and is_org_member(organization_id)
  );
