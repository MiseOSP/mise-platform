-- 004 Stripe webhook idempotency
-- Stripe may deliver the same webhook event more than once. We record each
-- processed event id so the webhook handler can safely no-op on retries
-- instead of double-applying side effects (e.g. crediting a payout twice).
create table stripe_events (
  id text primary key, -- Stripe event id (evt_...)
  type text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

alter table stripe_events enable row level security;

-- Only the service role (used by the stripe-webhook Edge Function) touches
-- this table directly; it intentionally has no client-facing policies.
