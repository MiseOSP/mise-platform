-- 013 payments & payouts: read-only financial visibility.
-- Both tables are populated exclusively by trusted backend/webhook processes
-- (Stripe payment_intent / transfer webhooks) using the service role, which
-- bypasses RLS entirely -- so only SELECT policies are defined here. No
-- authenticated app user (management, chef, or client) may insert, update,
-- or delete rows directly.

alter table payments enable row level security;
alter table payouts enable row level security;

-- Payments: visible to org management and the client who owns the event
-- (their own payment status). Chefs are intentionally excluded -- payment is
-- a client-to-organization transaction and not part of a chef's scope.
create policy payments_select_management_client on payments
  for select
  to authenticated
  using (
    exists (
      select 1 from events e
      where e.id = payments.event_id
        and (
          is_org_management(e.organization_id)
          or e.client_id in (select id from client_profiles where user_id = app_user_id())
        )
    )
  );

-- Payouts: visible to org management and the specific chef the payout is
-- for. Clients are intentionally excluded -- a chef's payout amount is
-- between the platform and the chef, not the client.
create policy payouts_select_management_chef on payouts
  for select
  to authenticated
  using (
    exists (
      select 1 from events e
      where e.id = payouts.event_id
        and is_org_management(e.organization_id)
    )
    or exists (
      select 1 from chef_profiles cp
      where cp.id = payouts.chef_id
        and cp.user_id = app_user_id()
    )
  );
