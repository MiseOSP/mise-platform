# Edge Functions (scaffold)

These functions are **scaffolds only**. They have not been deployed, and no
real secrets have been entered anywhere by the assistant that built them.
Review the code before deploying, and fill in the TODOs (especially caller
verification in twilio-send-message).

## Functions

- `stripe-webhook` - receives Stripe webhook events (payments, Stripe Connect
  account updates, payouts, platform subscription changes). Idempotent via
  the `stripe_events` table (see `supabase/migrations/004_stripe_events.sql`).
- `stripe-connect-onboarding` - creates a Stripe Connect Express account for a
  chef and returns an onboarding link.
- `twilio-send-message` - sends an SMS via Twilio and logs it to `messages`.

## Required secrets (set these yourself -- never paste real keys into chat)

Set via the Supabase Dashboard (Project Settings -> Edge Functions -> Secrets)
or the CLI:

```
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set TWILIO_ACCOUNT_SID=AC...
supabase secrets set TWILIO_AUTH_TOKEN=...
supabase secrets set TWILIO_FROM_NUMBER=+1...
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
the platform at runtime -- do not set these manually.

## Deploying

```
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy stripe-connect-onboarding
supabase functions deploy twilio-send-message
```

`stripe-webhook` needs `--no-verify-jwt` because Stripe calls it directly
(not through a logged-in user's session); it authenticates the request via
the Stripe-Signature header instead. The other two functions keep Supabase's
default JWT verification so only a signed-in app user can call them.

After deploying `stripe-webhook`, register its URL as a webhook endpoint in
the Stripe Dashboard and copy the resulting signing secret into
`STRIPE_WEBHOOK_SECRET` above.

## Known follow-ups

- `twilio-send-message` trusts `senderId` from the request body -- before
  going live, derive it from the verified caller's JWT and confirm they're a
  participant of the given conversation.
- Business logic in `stripe-webhook` (e.g. exact payout/refund handling) is a
  reasonable starting point but hasn't been validated against Document 17's
  full payment lifecycle -- review before relying on it in production.
