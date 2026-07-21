-- 026 Event charge breakdown view (v2.0 Sections 14, 25, 35)
-- Read-only companion to event_financial_summary (migration 023). That view
-- returns overall totals + deposit base/due; this one exposes per-CATEGORY
-- subtotals so the client estimate/proposal screen (v2.0 Section 35) can show
-- separately-labeled components (service subtotal, fixed add-ons, grocery
-- estimate, rentals, taxes, adjustments, discounts) without the client ever
-- computing money itself. Purely additive: no new tables, no write surface,
-- no change to existing charge rows. Money stays in integer minor units.

create or replace view event_charge_breakdown as
select
  c.event_id,
  c.organization_id,
  c.category,
  c.deposit_eligible,
  sum(c.amount_cents) as subtotal_cents,
  count(*) as line_count,
  min(c.currency) as currency
from event_charges c
where c.deleted_at is null
group by c.event_id, c.organization_id, c.category, c.deposit_eligible;

-- Views run with the querying user's privileges and are backed by
-- event_charges, which already enforces RLS (staff of the org, or the client
-- tied to the event, may read; only admins may write -- see migration 023).
-- No additional grants are needed: the underlying table policies govern access,
-- and this view exposes strictly less than the base rows (aggregates only).
comment on view event_charge_breakdown is
  'Per-category charge subtotals for an event. Read-only aggregate over event_charges; access governed by event_charges RLS. Used by the client estimate screen (v2.0 Section 35).';

-- Guard: assert the anon role has NOT been granted read on this view. Public
-- estimate data must never leak to unauthenticated callers; estimates are only
-- ever shown to the authenticated client on the event or org staff.
do $$
begin
  if exists (
    select 1 from information_schema.role_table_grants
    where table_name = 'event_charge_breakdown'
      and grantee = 'anon'
      and privilege_type = 'SELECT'
  ) then
    raise exception 'event_charge_breakdown must not be readable by anon';
  end if;
end $$;
