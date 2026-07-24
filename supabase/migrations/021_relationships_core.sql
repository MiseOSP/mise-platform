-- 021 Relationship-centric layer (v2.0 refactor)
-- Introduces the Relationship as the enduring client record (v2.0 Sections
-- 9, 16, 19). A Relationship is created at first inquiry and does NOT require
-- a user account. client_profiles is retained but a relationship_id link is
-- added so existing 1:1 client identity can be reconciled into the new model.
-- Events and memberships will attach to relationships in later migrations.
-- RLS is defined from the start, reusing helpers from migration 003:
--   app_user_id(), is_org_member(uuid), is_org_admin(uuid).

-- relationships ----------------------------------------------------------
create table relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  relationship_type text not null default 'individual'
    check (relationship_type in ('household','business','individual')),
  display_name text not null,
  -- lifecycle: an inquiry becomes a relationship immediately
  lead_status text not null default 'inquiry'
    check (lead_status in ('inquiry','qualifying','active','dormant','lost')),
  client_status text not null default 'prospect'
    check (client_status in ('prospect','one_time','member','former')),
  referral_source text,
  -- optional link to an authenticated user once an account is created
  primary_user_id uuid references users(id),
  lifetime_value_cents bigint not null default 0,
  currency text not null default 'usd',
  important_notes text,       -- shared, client-safe context
  internal_notes text,        -- staff-only; never exposed to clients
  first_inquiry_at timestamptz not null default now(),
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on relationships (organization_id);
create index on relationships (client_status);
create index on relationships (lead_status);
create index on relationships (primary_user_id);

-- relationship_contacts --------------------------------------------------
create table relationship_contacts (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references relationships(id),
  is_primary boolean not null default false,
  first_name text,
  last_name text,
  email text,
  phone text,
  role_label text,            -- e.g. 'spouse', 'assistant', 'event lead'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on relationship_contacts (relationship_id);
create index on relationship_contacts (email);
create index on relationship_contacts (phone);

-- relationship_addresses -------------------------------------------------
create table relationship_addresses (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references relationships(id),
  label text,                 -- 'home', 'office', 'vacation rental'
  line1 text,
  line2 text,
  city text,
  state text,
  postal_code text,
  is_default_service boolean not null default false,
  kitchen_notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on relationship_addresses (relationship_id);

-- relationship_preferences ----------------------------------------------
create table relationship_preferences (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references relationships(id),
  favorite_ingredients text,
  disliked_ingredients text,
  hospitality_preferences text,
  communication_preferences text,
  updated_at timestamptz not null default now()
);
create unique index on relationship_preferences (relationship_id);

-- dietary_requirements ---------------------------------------------------
-- v2.0 Section 68: distinguish preference / intolerance / allergy.
create table dietary_requirements (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references relationships(id),
  kind text not null default 'preference'
    check (kind in ('preference','intolerance','allergy','other')),
  label text not null,
  severity text check (severity in ('mild','moderate','severe','life_threatening')),
  notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on dietary_requirements (relationship_id);

-- link existing client_profiles into the relationship model (non-destructive)
alter table client_profiles
  add column if not exists relationship_id uuid references relationships(id);
create index if not exists client_profiles_relationship_id_idx
  on client_profiles (relationship_id);

-- ------------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------------
alter table relationships enable row level security;
alter table relationship_contacts enable row level security;
alter table relationship_addresses enable row level security;
alter table relationship_preferences enable row level security;
alter table dietary_requirements enable row level security;

-- Staff (any active org member) may read; admins manage. Clients may read
-- only the relationship linked to their own user (primary_user_id).
create policy relationships_select_staff on relationships
  for select to authenticated
  using (is_org_member(organization_id) and deleted_at is null);

create policy relationships_select_self on relationships
  for select to authenticated
  using (deleted_at is null and primary_user_id = app_user_id());

create policy relationships_manage_admin on relationships
  for all to authenticated
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- Helper: does the current user belong to the org that owns this relationship,
-- or is it their own relationship? Used by child tables.
create or replace function can_read_relationship(rel_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from relationships r
    where r.id = rel_id
      and r.deleted_at is null
      and (is_org_member(r.organization_id) or r.primary_user_id = app_user_id())
  )
$$;

create or replace function can_manage_relationship(rel_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from relationships r
    where r.id = rel_id
      and is_org_admin(r.organization_id)
  )
$$;

grant execute on function can_read_relationship(uuid) to authenticated;
grant execute on function can_manage_relationship(uuid) to authenticated;

-- relationship_contacts
create policy rc_select on relationship_contacts
  for select to authenticated
  using (deleted_at is null and can_read_relationship(relationship_id));
create policy rc_manage on relationship_contacts
  for all to authenticated
  using (can_manage_relationship(relationship_id))
  with check (can_manage_relationship(relationship_id));

-- relationship_addresses
create policy ra_select on relationship_addresses
  for select to authenticated
  using (deleted_at is null and can_read_relationship(relationship_id));
create policy ra_manage on relationship_addresses
  for all to authenticated
  using (can_manage_relationship(relationship_id))
  with check (can_manage_relationship(relationship_id));

-- relationship_preferences
create policy rp_select on relationship_preferences
  for select to authenticated
  using (can_read_relationship(relationship_id));
create policy rp_manage on relationship_preferences
  for all to authenticated
  using (can_manage_relationship(relationship_id))
  with check (can_manage_relationship(relationship_id));

-- dietary_requirements
create policy dr_select on dietary_requirements
  for select to authenticated
  using (deleted_at is null and can_read_relationship(relationship_id));
create policy dr_manage on dietary_requirements
  for all to authenticated
  using (can_manage_relationship(relationship_id))
  with check (can_manage_relationship(relationship_id));
