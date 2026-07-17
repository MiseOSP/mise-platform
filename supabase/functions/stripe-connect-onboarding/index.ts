// Creates (or resumes) a Stripe Connect Express onboarding link for a chef.
//
// SCAFFOLD ONLY -- not deployed or activated. Requires:
//   STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy with: supabase functions deploy stripe-connect-onboarding
// (default JWT verification stays ON -- only a signed-in chef may call this)
//
// Expects POST body: { "chefProfileId": "<uuid>", "returnUrl": "https://..." }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2023-10-16' });
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  // Client-scoped: runs as the calling user, so RLS still applies to reads.
  const supabaseAsCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  // Service-role client: only used for the narrow write below (setting the
  // Stripe account id), after we've confirmed the caller owns this profile.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { chefProfileId, returnUrl } = await req.json();
    if (!chefProfileId || !returnUrl) {
      return new Response(JSON.stringify({ error: 'chefProfileId and returnUrl are required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: profile, error: profileError } = await supabaseAsCaller
      .from('chef_profiles')
      .select('id, stripe_connect_account_id')
      .eq('id', chefProfileId)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Chef profile not found or not accessible' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    let accountId = profile.stripe_connect_account_id as string | null;
    if (!accountId) {
      const account = await stripe.accounts.create({ type: 'express' });
      accountId = account.id;
      const { error: updateError } = await supabaseAdmin
        .from('chef_profiles')
        .update({ stripe_connect_account_id: accountId })
        .eq('id', chefProfileId);
      if (updateError) throw updateError;
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return new Response(JSON.stringify({ url: accountLink.url }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('stripe-connect-onboarding error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
