import { supabase } from './supabase';

// Read-only view of Mise's own SaaS billing record for an organization.
// Rows are written exclusively by the stripe-webhook Edge Function (see
// supabase/functions/stripe-webhook) via the service role; the app never
// writes to this table directly, and RLS restricts reads to management of
// the owning organization (see 016_platform_subscriptions_rls.sql).

export type PlatformSubscription = {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
};

export async function fetchPlatformSubscription(organizationId: string): Promise<{
  data: PlatformSubscription | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('platform_subscriptions')
    .select('plan, status, current_period_end')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  return {
    data: {
      plan: data.plan,
      status: data.status,
      currentPeriodEnd: data.current_period_end,
    },
    error: null,
  };
}
