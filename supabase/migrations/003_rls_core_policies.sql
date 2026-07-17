-- 003 core RLS policies
-- RLS was enabled on every table in 001_init.sql but no policies were defined,
-- meaning every table was effectively inaccessible to the anon/authenticated
-- client (only the postgres/service_role bypasses RLS). This migration adds
-- the minimum policy set needed for the Sprint 1 onboarding flow: users,
-- profiles, organizations, organization_members, and read-only access to the
-- roles/permissions reference tables. Policies for events/menus/messaging
-- etc. land in later migrations alongside the screens that need them.

-- Helper functions are SECURITY DEFINER + owned by the migration role (which
-- owns these tables), so they bypass RLS internally and avoid infinite
-- recursion when a table's own policy needs to query that same table.

create or replace function app_user_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from users where auth_id = auth.uid() and deleted_at is null
$$;

create or replace function is_org_member(target_org uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where organization_id = target_org
      and user_id = app_user_id()
      and status = 'active'
      and deleted_at is null
  )
$$;

create or replace function is_org_admin(target_org uuid)
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
      and r.name in ('owner', 'admin')
  )
$$;

create or replace function shares_org_with(target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from organization_members mine
    join organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = app_user_id()
      and theirs.user_id = target_user_id
      and mine.status = 'active' and theirs.status = 'active'
      and mine.deleted_at is null and theirs.deleted_at is null
  )
$$;

grant execute on function app_user_id() to authenticated;
grant execute on function is_org_member(uuid) to authenticated;
grant execute on function is_org_admin(uuid) to authenticated;
grant execute on function shares_org_with(uuid) to authenticated;

-- users -----------------------------------------------------------------
create policy users_select_self_or_org_peer on users
  for select
  using (auth_id = auth.uid() or shares_org_with(id));

create policy users_insert_self on users
  for insert
  to authenticated
  with check (auth_id = auth.uid());

create policy users_update_self on users
  for update
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid());

-- profiles ---------------------------------------------------------------
create policy profiles_select_self_or_org_peer on profiles
  for select
  using (user_id = app_user_id() or shares_org_with(user_id));

create policy profiles_insert_self on profiles
  for insert
  to authenticated
  with check (user_id = app_user_id());

create policy profiles_update_self on profiles
  for update
  using (user_id = app_user_id())
  with check (user_id = app_user_id());

-- organizations ------------------------------------------------------------
create policy organizations_select_member on organizations
  for select
  using (is_org_member(id));

create policy organizations_insert_any_authenticated on organizations
  for insert
  to authenticated
  with check (true);

create policy organizations_update_admin on organizations
  for update
  using (is_org_admin(id))
  with check (is_org_admin(id));

-- organization_members ---------------------------------------------------------
create policy organization_members_select_member on organization_members
  for select
  using (is_org_member(organization_id));

-- Bootstrap case: a brand-new org has zero active members yet, so the
-- creating user may insert themselves. Once an org has members, only an
-- existing owner/admin may add further members.
create policy organization_members_insert_bootstrap_or_admin on organization_members
  for insert
  to authenticated
  with check (
    (
      user_id = app_user_id()
      and not exists (
        select 1 from organization_members existing
        where existing.organization_id = organization_members.organization_id
          and existing.deleted_at is null
      )
    )
    or is_org_admin(organization_id)
  );

create policy organization_members_update_admin on organization_members
  for update
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- roles / permissions / role_permissions: read-only reference data, managed
-- only via migrations (no client-side writes).
create policy roles_select_authenticated on roles
  for select
  to authenticated
  using (true);

create policy permissions_select_authenticated on permissions
  for select
  to authenticated
  using (true);

create policy role_permissions_select_authenticated on role_permissions
  for select
  to authenticated
  using (true);
