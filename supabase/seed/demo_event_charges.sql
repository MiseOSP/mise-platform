-- ============================================================================
-- DEMO EVENT CHARGES for Nashville Chef Service (tenant #1)
--
-- Purpose: flesh out the "Anniversary Dinner (demo)" event with a realistic,
-- clearly-labeled set of charges so the client estimate/checkout screen shows
-- a non-zero deposit and a full per-category breakdown.
--
-- SAFETY NOTES:
--   * Run this in the Supabase SQL editor (service role) for the DEV project.
--   * It does NOT create any auth accounts or events.
--   * It is idempotent: re-running deletes the demo charges it manages (matched
--     by exact description) and re-inserts them, so no duplicates accumulate.
--   * Amounts below are ILLUSTRATIVE demo figures, not Nashville Chef Service's
--     real pricing. Adjust freely.
--
-- Deposit math (see migration 023 event_financial_summary):
--   deposit_due = 50% of the sum of deposit-eligible charges
--   deposit-eligible categories (auto via trigger): 'service', 'fixed_add_on'
--   'grocery_estimate' and 'rental' are NOT part of the deposit.
--   With the figures below:
--     service       $650.00  (deposit-eligible)
--     fixed_add_on  $280.00  (deposit-eligible)  -> base $930.00, deposit $465.00
--     grocery_estimate $420.00 (estimate, not in deposit)
--     rental        $90.00   (not in deposit)
--     total        $1,440.00
-- ============================================================================

do $$
declare
  v_org_id uuid;
  v_event_id uuid;
begin
  select id into v_org_id
    from organizations
    where slug = 'nashville-chef-service'
    limit 1;

  if v_org_id is null then
    raise notice 'Nashville Chef Service org not found (slug nashville-chef-service); nothing seeded.';
    return;
  end if;

  select id into v_event_id
    from events
    where organization_id = v_org_id
      and occasion = 'Anniversary Dinner (demo)'
    limit 1;

  if v_event_id is null then
    raise notice 'Demo event "Anniversary Dinner (demo)" not found; run demo_ncs_preview.sql first. Nothing seeded.';
    return;
  end if;

  -- Idempotency: remove the specific demo charges this seed manages, then re-add.
  delete from event_charges
    where event_id = v_event_id
      and description in (
        'Private chef service - 4-course tasting (8 guests)',
        'Wine pairing add-on (8 guests)',
        'Estimated grocery cost (billed at actual)',
        'Table linens & glassware rental'
      );

  -- deposit_eligible is auto-set by the trigger from category
  -- ('service','fixed_add_on' -> true). We leave it to the trigger.
  insert into event_charges
    (organization_id, event_id, category, description, amount_cents, is_estimate)
  values
    (v_org_id, v_event_id, 'service',
       'Private chef service - 4-course tasting (8 guests)', 65000, false),
    (v_org_id, v_event_id, 'fixed_add_on',
       'Wine pairing add-on (8 guests)', 28000, false),
    (v_org_id, v_event_id, 'grocery_estimate',
       'Estimated grocery cost (billed at actual)', 42000, true),
    (v_org_id, v_event_id, 'rental',
       'Table linens & glassware rental', 9000, false);

  raise notice 'Demo event charges seeded for event %.', v_event_id;
end $$;
