-- 023 Financial ledger (v2.0 Sections 14, 15, 25, 56)
-- Replaces the flat service_fee/food_cost model on events with a line-item
-- ledger. Money is stored as INTEGER MINOR UNITS (cents), never floats.
-- Deposit eligibility is a per-line property. Locked Nashville pilot rule:
-- deposit = 50% of (service subtotal + fixed add-ons). Groceries, rentals,
-- taxes, and adjustments are excluded from the deposit.
-- The event balance is DERIVED from charges/discounts/refunds and payments,
-- not stored as an editable number.

-- 1. event_charges -------------------------------------------------------
create table event_charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  event_id uuid not null references events(id),
  category text not null
    check (category in (
      'service','fixed_add_on','grocery_estimate','grocery_actual',
      'rental','tax','adjustment','discount','gratuity'
    )),
  description text,
  -- amount in minor units; discounts are stored as negative amounts
  amount_cents bigint not null default 0,
  currency text not null default 'usd',
  -- deposit eligibility is a property of the line item (v2.0 Section 25).
  -- Only service and fixed_add_on are eligible for the Nashville pilot; this
  -- column defaults from the category via the trigger below but can be
  -- overridden by an admin for exceptional cases.
  deposit_eligible boolean not null default false,
  is_estimate boolean not null default false,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on event_charges (event_id);
create index on event_charges (organization_id);
create index on event_charges (category);

-- default deposit_eligible from category unless explicitly set
create or replace function set_charge_deposit_eligibility()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    -- only auto-set when the caller left the default (false) untouched
    if new.deposit_eligible is null or new.deposit_eligible = false then
      new.deposit_eligible := new.category in ('service','fixed_add_on');
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_charge_deposit_eligibility
  before insert on event_charges
  for each row execute function set_charge_deposit_eligibility();

-- 2. tenant payments: migrate to minor units + type/link to charges -------
-- Existing payments.amount was numeric; add a cents column and a purpose.
alter table payments add column if not exists amount_cents bigint;
alter table payments add column if not exists currency text not null default 'usd';
alter table payments add column if not exists purpose text
  check (purpose in ('deposit','final','adjustment','refund_offset'));

-- 3. refunds (separate from payments; v2.0 Section 25) --------------------
create table refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  event_id uuid references events(id),
  payment_id uuid references payments(id),
  amount_cents bigint not null,
  currency text not null default 'usd',
  reason text,
  stripe_refund_id text unique,
  status text not null default 'pending'
    check (status in ('pending','succeeded','failed','canceled')),
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index on refunds (event_id);
create index on refunds (organization_id);

-- 4. Derived financial views ---------------------------------------------
-- Deposit due = 50% of the sum of deposit-eligible charges.
-- Total = sum of all non-deleted charges (discounts are negative).
-- Paid = sum of succeeded payments. Refunded = sum of succeeded refunds.
-- Balance = total - (paid - refunded).
create or replace view event_financial_summary as
select
  e.id as event_id,
  e.organization_id,
  coalesce(sum(c.amount_cents) filter (where c.deleted_at is null), 0) as total_cents,
  coalesce(sum(c.amount_cents) filter (
    where c.deleted_at is null and c.deposit_eligible
  ), 0) as deposit_base_cents,
  -- integer-safe 50%: floor(base/2). Deposit rounding policy can be revisited.
  (coalesce(sum(c.amount_cents) filter (
    where c.deleted_at is null and c.deposit_eligible
  ), 0) / 2) as deposit_due_cents,
  coalesce((
    select sum(p.amount_cents) from payments p
    where p.event_id = e.id and p.status = 'succeeded'
  ), 0) as paid_cents,
  coalesce((
    select sum(r.amount_cents) from refunds r
    where r.event_id = e.id and r.status = 'succeeded'
  ), 0) as refunded_cents
from events e
left join event_charges c on c.event_id = e.id
group by e.id, e.organization_id;

-- 5. RLS -----------------------------------------------------------------
alter table event_charges enable row level security;
alter table refunds enable row level security;

-- Staff of the owning org may read charges; the client tied to the event may
-- read their own charges. Only admins may write. (Client read policy joins
-- through events -> client_profiles -> user.)
create policy event_charges_select_staff on event_charges
  for select to authenticated
  using (is_org_member(organization_id) and deleted_at is null);

create policy event_charges_select_client on event_charges
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from events ev
      join client_profiles cp on cp.id = ev.client_id
      where ev.id = event_charges.event_id
        and cp.user_id = app_user_id()
    )
  );

create policy event_charges_manage_admin on event_charges
  for all to authenticated
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- Refunds are financially sensitive: staff read, admin manage only.
create policy refunds_select_staff on refunds
  for select to authenticated
  using (is_org_member(organization_id));

create policy refunds_manage_admin on refunds
  for all to authenticated
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));
