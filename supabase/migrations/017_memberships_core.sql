-- 017 Membership platform core (NCS Reserve pivot)
-- membership_plans, memberships, service_credits, recurring_schedules
-- plus linking columns on events. RLS from the start.

create table membership_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  member_type text not null check (member_type in ('household','business')),
  billing_frequency text not null check (billing_frequency in ('monthly','select','weekly','twice_monthly','quarterly','custom')),
  included_credits integer not null default 0,
  credit_expiration_days integer,
  base_price numeric not null default 0,
  add_on_pricing jsonb not null default '{}'::jsonb,
  cancellation_policy text,
  rescheduling_policy text,
  included_benefits text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on membership_plans (organization_id);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  client_id uuid not null references client_profiles(id),
  plan_id uuid not null references membership_plans(id),
  status text not null default 'pending' check (status in ('pending','active','paused','cancelled')),
  preferred_day_of_week smallint check (preferred_day_of_week between 0 and 6),
  preferred_service_window text,
  start_date date,
  next_billing_date date,
  paused_at timestamptz,
  resumes_at date,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on memberships (organization_id);
create index on memberships (client_id);
create index on memberships (status);

create table service_credits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  membership_id uuid not null references memberships(id),
  status text not null default 'available' check (status in ('available','reserved','used','expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  used_event_id uuid references events(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on service_credits (membership_id);
create index on service_credits (organization_id);
create index on service_credits (status);

create table recurring_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  membership_id uuid not null references memberships(id),
  pattern_type text not null check (pattern_type in ('weekly','biweekly','monthly_day_of_week','monthly_last_weekday','custom')),
  day_of_week smallint check (day_of_week between 0 and 6),
  week_of_month smallint check (week_of_month between -1 and 4),
  interval_weeks smallint not null default 1,
  preferred_time time,
  next_occurrence date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on recurring_schedules (membership_id);
create index on recurring_schedules (organization_id);

alter table events add column if not exists membership_id uuid references memberships(id);
alter table events add column if not exists service_credit_id uuid references service_credits(id);
alter table events add column if not exists is_membership_visit boolean not null default false;
create index if not exists events_membership_id_idx on events (membership_id);

alter table membership_plans enable row level security;
alter table memberships enable row level security;
alter table service_credits enable row level security;
alter table recurring_schedules enable row level security;

create policy membership_plans_select_staff on membership_plans
  for select to authenticated
  using (is_org_member(organization_id) and deleted_at is null);

create policy membership_plans_select_client on membership_plans
  for select to authenticated
  using (
    active and deleted_at is null
    and exists (
      select 1 from client_profiles cp
      where cp.organization_id = membership_plans.organization_id
        and cp.user_id = app_user_id()
    )
  );

create policy membership_plans_manage_admin on membership_plans
  for all to authenticated
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

create policy memberships_select_self on memberships
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from client_profiles cp
      where cp.id = memberships.client_id and cp.user_id = app_user_id()
    )
  );

create policy memberships_update_self on memberships
  for update to authenticated
  using (
    exists (
      select 1 from client_profiles cp
      where cp.id = memberships.client_id and cp.user_id = app_user_id()
    )
  )
  with check (
    exists (
      select 1 from client_profiles cp
      where cp.id = memberships.client_id and cp.user_id = app_user_id()
    )
  );

create policy memberships_select_staff on memberships
  for select to authenticated
  using (is_org_member(organization_id));

create policy memberships_manage_staff on memberships
  for all to authenticated
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

create policy service_credits_select_self on service_credits
  for select to authenticated
  using (
    exists (
      select 1 from memberships m
      join client_profiles cp on cp.id = m.client_id
      where m.id = service_credits.membership_id and cp.user_id = app_user_id()
    )
  );

create policy service_credits_select_staff on service_credits
  for select to authenticated
  using (is_org_member(organization_id));

create policy service_credits_manage_staff on service_credits
  for all to authenticated
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

create policy recurring_schedules_select_self on recurring_schedules
  for select to authenticated
  using (
    exists (
      select 1 from memberships m
      join client_profiles cp on cp.id = m.client_id
      where m.id = recurring_schedules.membership_id and cp.user_id = app_user_id()
    )
  );

create policy recurring_schedules_update_self on recurring_schedules
  for update to authenticated
  using (
    exists (
      select 1 from memberships m
      join client_profiles cp on cp.id = m.client_id
      where m.id = recurring_schedules.membership_id and cp.user_id = app_user_id()
    )
  )
  with check (
    exists (
      select 1 from memberships m
      join client_profiles cp on cp.id = m.client_id
      where m.id = recurring_schedules.membership_id and cp.user_id = app_user_id()
    )
  );

create policy recurring_schedules_select_staff on recurring_schedules
  for select to authenticated
  using (is_org_member(organization_id));

create policy recurring_schedules_manage_staff on recurring_schedules
  for all to authenticated
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));
