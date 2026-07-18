-- 016 Fix critical multi-tenant data leak: platform_subscriptions had no
-- row level security at all. Any authenticated user of ANY organization
-- could read (and, per Supabase's default grants, potentially write) every
-- organization's Stripe customer id, subscription id, plan and status --
-- Mise's own SaaS billing data for every tenant on the platform.

alter table platform_subscriptions enable row level security;

-- Only an organization's own management (owner/admin/manager) can view its
-- billing/subscription record. All writes happen exclusively via the
-- stripe-webhook Edge Function using the service role (see
-- supabase/functions/stripe-webhook), so no insert/update/delete policies
-- are defined here for regular users.
create policy platform_subscriptions_select_management
  on platform_subscriptions for select
  using (is_org_management(organization_id));
