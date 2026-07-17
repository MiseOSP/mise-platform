-- 009 chef_agreements RLS
-- Agreements are an append-only e-signature audit trail: a chef may insert a signed
-- agreement for themselves and read their own signing history, but never edit or delete a
-- row once created (there are intentionally no update/delete policies here). Management can
-- read signing status for chefs in their own organization to confirm onboarding is complete.

create policy chef_agreements_select_self on chef_agreements
  for select
  to authenticated
  using (
    chef_id in (select id from chef_profiles where user_id = app_user_id())
  );

create policy chef_agreements_insert_self on chef_agreements
  for insert
  to authenticated
  with check (
    chef_id in (select id from chef_profiles where user_id = app_user_id())
  );

create policy chef_agreements_select_management on chef_agreements
  for select
  to authenticated
  using (
    exists (
      select 1 from chef_profiles cp
      where cp.id = chef_agreements.chef_id
        and is_org_management(cp.organization_id)
    )
  );
