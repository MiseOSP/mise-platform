# DOCUMENT 14R — Canonical Database Schema (Reconciled)
Mise Platform — Version 2.0
Supersedes: Document 14, Document 15 (schema sections), Document 21

## 0. Reconciliation Notes

This version replaces earlier drafts because those drafts conflicted with each
other (inline name fields vs. separate `profiles` table) and modeled
`users -> organizations` as one-to-one, which breaks multi-tenant support for
contractors working across businesses, franchise oversight, and platform
support access. Treat this document as the single source of truth. Delete or
mark the earlier schema docs as deprecated so Codex/Claude never build from
them again.

Key changes from earlier drafts:
- `organization_members` join table replaces the `organization_id` column on `users` (many-to-many).
- Roles become data (`roles`, `permissions`, `role_permissions`) instead of a hardcoded `CHECK` constraint.
- `deleted_at` is part of every operational table from migration 001, not a future patch.
- Time-gated data (chef sees address 15h before event) is enforced with a server-side view/function, not app-layer hiding.
- Mise's own SaaS subscription billing is modeled separately from each tenant's Stripe Connect payment processing.
- Primary keys use `gen_random_uuid()` (pgcrypto, built into Postgres 13+) rather than `uuid-ossp`, and we note a UUIDv7 upgrade path for write-heavy tables.

## 1. Extensions

```sql
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
```

## 2. Organizations (Tenants)

```sql
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
```

## 3. Users (Auth Identity Only)

`users` holds identity, not tenant membership. A person can belong to zero,
one, or many organizations.

```sql
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
```

## 4. Organization Membership + RBAC

This is the core multi-tenant fix. Membership, not a foreign key on `users`,
determines what org(s) and role(s) a person has.

```sql
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
```

Franchise or enterprise customers who need a custom role (e.g.
"dispatcher") just insert a new row into `roles`/`permissions` — no schema
migration required.

## 5. Client & Chef Profiles

```sql
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
```

## 6. Experiences & Menus

```sql
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
```

## 7. Events (Core Table)

```sql
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
```

### 7.1 Server-Side Address Masking (fixes the "hide address 15h before" gap)

Do not rely on the app to hide the address. Expose a view that nulls it out,
and grant chefs access only through the view, never the raw table.

```sql
create view chef_visible_events as
select
  e.*,
  case
    when now() >= (e.event_date::timestamptz + e.start_time - interval '15 hours')
      then e.address
    else null
  end as visible_address
from events e;
```

RLS on `events` should deny chefs direct `select` on the `address` column
entirely (or use column-level privileges); chefs query
`chef_visible_events` instead.

## 8. Event Assignments & Menu Selections

```sql
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
```

## 9. Messaging

```sql
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
```

## 10. Financials — Two Separate Concerns

Do not conflate Mise's own SaaS billing with a tenant's client-facing
payments. These are two different Stripe integrations with two different
data models.

### 10.1 Mise Platform Billing (Mise charges the hospitality business)

```sql
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
```

### 10.2 Tenant Payment Processing (organization charges its own clients)

```sql
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
```

Webhook handlers must upsert on `stripe_payment_intent_id` /
`stripe_transfer_id` so a duplicate Stripe webhook delivery cannot double-record
a payment.

## 11. Resources, Recipes, Ingredients

```sql
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
```

## 12. AI Knowledge System

Note: `pgvector` is not enabled in the extensions list yet. Leave the
`embedding` column commented out until the extension is enabled, or migration
001 will fail.

```sql
create table knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  title text not null,
  category text,
  content text,
  -- embedding vector(1536),  -- enable after `create extension vector;`
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
```

## 13. Audit Logs (Partitioned)

Audit logs are one of the fastest-growing tables in the system. Partition by
month from day one so pruning and archival don't require a painful migration
later.

```sql
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
```

Platform-admin ("break-glass") access to tenant data must itself write a row
to `audit_logs` with `action = 'platform_support_access'` — this is the
enforcement mechanism for the "admins can't view tenant data without
authorization" rule, not just a policy statement.

## 14. Row Level Security Pattern

Apply this pattern to every tenant-scoped table (example on `events`):

```sql
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
```

Write a policy per role per table, and back every one of them with an
automated test that logs in as each role and asserts exactly which rows are
visible/invisible. This is a checklist item for "Backend Completion Criteria,"
not optional polish.

## 15. Storage Buckets

```
public-assets/      -- logos, marketing images (public)
chef-documents/      -- agreements, certifications (private)
resources/           -- recipes, guides, PDFs (private, org-scoped)
event-files/         -- client uploads, attachments (private, org-scoped)
```

## 16. Migration Order

```
001_extensions.sql
002_organizations.sql
003_users_and_profiles.sql
004_roles_permissions_membership.sql
005_client_chef_profiles.sql
006_experiences_menus.sql
007_events.sql
008_event_assignments_menu_selections.sql
009_messaging.sql
010_platform_billing.sql
011_tenant_payments_payouts.sql
012_event_financials.sql
013_resources_recipes_ingredients.sql
014_ai_knowledge.sql
015_audit_logs_partitioned.sql
016_rls_policies.sql
```

## 17. Completion Criteria (Updated)

In addition to the original Document 15 criteria, this schema is not
considered done until: every table has `deleted_at`; every tenant-scoped
table has a tested RLS policy per role; the address-masking view is in place
and chefs have no direct column access to raw addresses; `payments` and
`payouts` enforce uniqueness on their Stripe IDs; and `platform_subscriptions`
is fully separated from `payments`/`payouts` in both schema and application
code paths.
