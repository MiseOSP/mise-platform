-- 036 chef availability (spec S91/S102 "Manage availability"; S15 defers chef-maintained
-- availability to the Chef Portal phase). A chef declares which weekdays they are generally
-- available, with an optional time window and note. This is a recurring weekly pattern, not
-- a per-date calendar -- admins still assign events manually in the MVP (S15), so this is
-- advisory scheduling input rather than an authorization gate.
--
-- Security (spec S51/S60/S65): RLS is the boundary. A chef has full CRUD on their OWN rows
-- only; management (owner/admin) may read their org's chefs' availability to plan staffing.

create table if not exists chef_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  chef_id uuid not null references chef_profiles(id),
  weekday smallint not null check (weekday between 0 and 6),
  start_time text,
  end_time text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (chef_id, weekday)
);

create index if not exists chef_availability_chef_idx on chef_availability (chef_id);

alter table chef_availability enable row level security;

-- A chef may read their own availability rows.
create policy chef_availability_select_self on chef_availability
  for select
  to authenticated
  using (
    chef_id in (select id from chef_profiles where user_id = app_user_id())
  );

-- A chef may insert availability only for their own chef_profiles row.
create policy chef_availability_insert_self on chef_availability
  for insert
  to authenticated
  with check (
    chef_id in (select id from chef_profiles where user_id = app_user_id())
  );

-- A chef may update their own availability rows (and cannot reassign them to
-- another chef -- the with check re-verifies ownership on the new row).
create policy chef_availability_update_self on chef_availability
  for update
  to authenticated
  using (
    chef_id in (select id from chef_profiles where user_id = app_user_id())
  )
  with check (
    chef_id in (select id from chef_profiles where user_id = app_user_id())
  );

-- A chef may delete their own availability rows (hard delete is fine here: this
-- is advisory scheduling input, not an audited financial or status record).
create policy chef_availability_delete_self on chef_availability
  for delete
  to authenticated
  using (
    chef_id in (select id from chef_profiles where user_id = app_user_id())
  );

-- Management (owner/admin) may read their org's chefs' availability to plan staffing.
create policy chef_availability_select_management on chef_availability
  for select
  to authenticated
  using (is_org_management(organization_id));
