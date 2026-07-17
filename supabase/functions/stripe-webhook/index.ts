// Stripe webhook receiver.
//
// SCAFFOLD ONLY -- not deployed or activated. Requires these secrets to be
// set via `supabase secrets set` (never hard-code them here):
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Deploy with: supabase functions deploy stripe-webhook --no-verify-jwt
// (Stripe calls this directly, not via a logged-in user's session, so the
// default JWT check must be disabled; authenticity is verified below via
// the Stripe signature header instead.)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  if (!signature) return new Response('Missing Stripe-Signature header', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    return new Response('Invalid signature', { status: 400 });
  }

  const { error: idempotencyError } = await supabase
    .from('stripe_events')
    .insert({ id: event.id, type: event.type, payload: event as unknown as Record<string, unknown> });

  if (idempotencyError) {
    if (idempotencyError.code === '23505') {
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }
    console.error('Failed to record stripe event', idempotencyError);
    return new Response('Internal error', { status: 500 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await supabase
          .from('payments')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('stripe_payment_intent_id', intent.id);
        break;
      }
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const nextStatus = account.charges_enabled && account.payouts_enabled ? 'active' : 'pending';
        await supabase
          .from('chef_profiles')
          .update({ status: nextStatus })
          .eq('stripe_connect_account_id', account.id);
        break;
      }
      case 'transfer.paid': {
        const transfer = event.data.object as Stripe.Transfer;
        await supabase
          .from('payouts')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('stripe_transfer_id', transfer.id);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await supabase
          .from('platform_subscriptions')
          .update({
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error handling Stripe event ${event.id} (${event.type})`, err);
    return new Response('Handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
