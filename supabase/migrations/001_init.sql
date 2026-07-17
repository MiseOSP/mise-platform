-- 001 extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- 002 organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  primary_color text,
  subscription_plan text not null default 'pilot',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 003 users and profiles
create table users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid references auth.users(id) not null,
  email text,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table profiles (
  user_id uuid primary key references users(id),
  first_name text,
  last_name text,
  photo_url text,
  notes text,
  updated_at timestamptz not null default now()
);

-- 004 roles permissions membership
create table roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_system_role boolean not null default true
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null
);

create table role_permissions (
  role_id uuid references roles(id),
  permission_id uuid references permissions(id),
  primary key (role_id, permission_id)
);

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null references users(id),
  role_id uuid not null references roles(id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, user_id, role_id)
);

create index on organization_members (user_id);
create index on organization_members (organization_id);

-- 005 client & chef profiles
create table client_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null references users(id),
  address text,
  city text,
  state text,
  zip text,
  dietary_preferences text,
  allergies text,
  notes text,
  lifetime_value numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table chef_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null references users(id),
  bio text,
  specialties text[],
  servsafe_verified boolean not null default false,
  insurance_verified boolean not null default false,
  rating_average numeric not null default 0,
  status text not null default 'pending',
  stripe_connect_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table chef_agreements (
  id uuid primary key default gen_random_uuid(),
  chef_id uuid not null references chef_profiles(id),
  agreement_type text not null,
  document_version text not null,
  signature_data text,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 006 experiences & menus
create table experiences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  description text,
  starting_price numeric,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id),
  name text not null,
  display_order integer not null default 0,
  deleted_at timestamptz
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references menu_categories(id),
  name text not null,
  description text,
  price_modifier numeric not null default 0,
  active boolean not null default true,
  deleted_at timestamptz
);

-- 007 events
create table events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  client_id uuid not null references client_profiles(id),
  experience_id uuid references experiences(id),
  assigned_chef_id uuid references chef_profiles(id),
  status text not null default 'requested',
  event_date date not null,
  start_time time,
  guest_count integer,
  occasion text,
  address text,
  city text,
  state text,
  client_notes text,
  internal_notes text,
  service_fee numeric,
  food_cost_estimate numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index on events (organization_id);
create index on events (event_date);
create index on events (status);

create view chef_visible_events as
select
  e.*,
  case
    when now() >= (e.event_date::timestamptz + e.start_time - interval '15 hours')
      then e.address
    else null
  end as visible_address
from events e;

-- 008 event assignments & menu selections
create table event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  chef_id uuid not null references chef_profiles(id),
  role text not null default 'lead_chef',
  status text not null default 'pending',
  accepted_at timestamptz,
  completed_at timestamptz,
  deleted_at timestamptz
);

create table event_menu_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  menu_item_id uuid not null references menu_items(id),
  quantity integer not null default 1,
  price_adjustment numeric not null default 0
);

-- 009 messaging
create table conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  event_id uuid references events(id),
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id),
  sender_id uuid not null references users(id),
  message text,
  attachment_url text,
  channel text not null default 'app',
  external_message_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index on messages (conversation_id);
create index on messages (created_at);

-- 010 platform billing (Mise's own SaaS billing)
create table platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null,
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 011 tenant payments & payouts
create table payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  event_id uuid references events(id),
  stripe_payment_intent_id text unique,
  amount numeric not null,
  payment_type text not null,
  status text not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id),
  chef_id uuid not null references chef_profiles(id),
  amount numeric not null,
  stripe_transfer_id text unique,
  status text not null default 'pending',
  paid_at timestamptz
);

-- 012 event financials
create table event_financials (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) unique,
  service_revenue numeric not null default 0,
  food_cost_estimate numeric not null default 0,
  food_cost_actual numeric not null default 0,
  labor_cost numeric not null default 0,
  equipment_cost numeric not null default 0,
  other_costs numeric not null default 0,
  gross_profit numeric not null default 0,
  profit_margin numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- 013 resources, recipes, ingredients
create table resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  category text not null,
  title text not null,
  description text,
  content text,
  file_url text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index on resources (category);
create index on resources (organization_id);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  category text,
  unit text
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  experience_id uuid references experiences(id),
  name text not null,
  yield_amount numeric,
  yield_unit text,
  instructions text,
  created_at timestamptz not null default now()
);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id),
  ingredient_id uuid not null references ingredients(id),
  quantity numeric,
  unit text
);

-- 014 ai knowledge (embedding left disabled until pgvector is enabled)
create table knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  title text not null,
  category text,
  content text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid references users(id),
  role text,
  question text,
  response text,
  created_at timestamptz not null default now()
);

-- 015 audit logs, partitioned by month
create table audit_logs (
  id uuid default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid references users(id),
  action text not null,
  table_name text,
  record_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
) partition by range (created_at);

create table audit_logs_2026_07 partition of audit_logs
  for values from ('2026-07-01') to ('2026-08-01');

create table audit_logs_2026_08 partition of audit_logs
  for values from ('2026-08-01') to ('2026-09-01');

-- 016 row level security pattern (events table example)
alter table events enable row level security;

create or replace function current_user_org_ids()
returns setof uuid
language sql stable
as $$
  select organization_id
  from organization_members
  where user_id = (select id from users where auth_id = auth.uid())
    and deleted_at is null;
$$;

create policy org_isolation on events
  for select
  using (organization_id in (select current_user_org_ids()));
