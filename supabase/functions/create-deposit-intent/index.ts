// create-deposit-intent Edge Function
//
// Creates a Stripe PaymentIntent for an event DEPOSIT and records a pending
// payment row. This is the trusted server boundary for taking money (v2.0
// Sections 48, 51, 66, 98):
//   * The client is NEVER trusted to state the amount. The deposit is read
//     from the server-authoritative event_financial_summary view.
//   * The caller must be authenticated AND must be the client on the event
//     (verified via client_profiles). Anonymous callers cannot pay.
//   * We store the payment as 'pending'; the stripe-webhook function flips it
//     to 'paid' on payment_intent.succeeded (idempotent, signature-verified).
//
// Deploy WITH JWT verification (only logged-in clients may pay):
//   supabase functions deploy create-deposit-intent
// Required secrets: STRIPE_SECRET_KEY (SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY are injected automatically).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

// Service-role client for the trusted read of the authoritative summary and
// for the payment insert. RLS is bypassed here on purpose -- we do our OWN
// ownership check below before doing anything.
const admin = createClient(supabaseUrl, serviceRoleKey);

function isUuid(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return bad('Method not allowed', 405);

  // 1. Identify the caller from their bearer token. No token -> no payment.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return bad('Authentication required', 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return bad('Authentication required', 401);
  const userId = userData.user.id;

  // 2. Validate input. Only the eventId is accepted -- never an amount.
  let body: { eventId?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad('Invalid JSON body');
  }
  if (!isUuid(body.eventId)) return bad('A valid eventId is required');
  const eventId = body.eventId;

  // 3. Confirm the caller is the CLIENT on this event (ownership check).
  const { data: event, error: eventErr } = await admin
    .from('events')
    .select('id, organization_id, status, client_id, client_profiles!inner(user_id)')
    .eq('id', eventId)
    .maybeSingle();
  if (eventErr) {
    console.error('create-deposit-intent event lookup failed', eventErr);
    return bad('Could not process payment', 500);
  }
  if (!event) return bad('Event not found', 404);
  const ownerUserId = (event as { client_profiles?: { user_id?: string } }).client_profiles?.user_id;
  if (ownerUserId !== userId) return bad('You are not authorized to pay for this event', 403);

  // 4. Read the SERVER-AUTHORITATIVE deposit amount. This is the only source
  //    of the charge amount; the client cannot influence it.
  const { data: summary, error: sumErr } = await admin
    .from('event_financial_summary')
    .select('deposit_due_cents')
    .eq('event_id', eventId)
    .maybeSingle();
  if (sumErr) {
    console.error('create-deposit-intent summary read failed', sumErr);
    return bad('Could not process payment', 500);
  }
  const depositCents = Number(summary?.deposit_due_cents ?? 0);
  if (!Number.isInteger(depositCents) || depositCents <= 0) {
    return bad('This event has no deposit due yet.');
  }

  // 5. Reuse an existing pending deposit intent if one exists (idempotency:
  //    avoids stacking duplicate PaymentIntents if the client retries).
  const { data: existing } = await admin
    .from('payments')
    .select('id, stripe_payment_intent_id, amount_cents, status')
    .eq('event_id', eventId)
    .eq('purpose', 'deposit')
    .in('status', ['pending', 'requires_action'])
    .maybeSingle();

  if (existing?.stripe_payment_intent_id && Number(existing.amount_cents) === depositCents) {
    const intent = await stripe.paymentIntents.retrieve(existing.stripe_payment_intent_id);
    if (intent.client_secret && intent.status !== 'canceled' && intent.status !== 'succeeded') {
      return new Response(
        JSON.stringify({ clientSecret: intent.client_secret, amountCents: depositCents }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  // 6. Create a fresh PaymentIntent for exactly the authoritative amount.
  const intent = await stripe.paymentIntents.create({
    amount: depositCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: { event_id: eventId, purpose: 'deposit', user_id: userId },
  });

  // 7. Record the pending payment. The webhook will flip it to 'paid'.
  const { error: insErr } = await admin.from('payments').insert({
    organization_id: event.organization_id,
    event_id: eventId,
    stripe_payment_intent_id: intent.id,
    amount: depositCents / 100,
    amount_cents: depositCents,
    currency: 'usd',
    payment_type: 'deposit',
    purpose: 'deposit',
    status: 'pending',
  });
  if (insErr) {
    console.error('create-deposit-intent payment insert failed', insErr);
    // Cancel the orphaned intent so we don't leave a chargeable intent with
    // no matching row for the webhook to update.
    try {
      await stripe.paymentIntents.cancel(intent.id);
    } catch (cancelErr) {
      console.error('failed to cancel orphaned intent', cancelErr);
    }
    return bad('Could not start the deposit payment', 500);
  }

  return new Response(
    JSON.stringify({ clientSecret: intent.client_secret, amountCents: depositCents }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
