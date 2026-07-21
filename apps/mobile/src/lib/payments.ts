import { supabase } from './supabase';

// Read-only financial visibility. Rows in `payments` and `payouts` are
// written exclusively by trusted backend/webhook processes (Stripe
// payment_intent / transfer events) using the service role -- the app never
// inserts, updates, or deletes these rows directly. RLS restricts what each
// caller can see: payments are visible to org management and the client who
// owns the event; payouts are visible to org management and the specific
// chef the payout is for (see 013_payments_payouts_rls.sql).

export type EventPayment = {
  id: string;
  eventId: string;
  amount: number;
  paymentType: string;
  status: string;
  paidAt: string | null;
};

export async function fetchEventPayments(eventId: string): Promise<{
  data: EventPayment[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, event_id, amount, payment_type, status, paid_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((r: any) => ({
      id: r.id,
      eventId: r.event_id,
      amount: Number(r.amount) || 0,
      paymentType: r.payment_type,
      status: r.status,
      paidAt: r.paid_at,
    })),
    error: null,
  };
}

export type EventPayout = {
  id: string;
  eventId: string;
  chefId: string;
  amount: number;
  status: string;
  paidAt: string | null;
};

export async function fetchEventPayouts(eventId: string): Promise<{
  data: EventPayout[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('payouts')
    .select('id, event_id, chef_id, amount, status, paid_at')
    .eq('event_id', eventId)
    .order('paid_at', { ascending: false });

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((r: any) => ({
      id: r.id,
      eventId: r.event_id,
      chefId: r.chef_id,
      amount: Number(r.amount) || 0,
      status: r.status,
      paidAt: r.paid_at,
    })),
    error: null,
  };
}

// Deposit payment initiation (v2.0 Sections 48, 66). Calls the trusted
// create-deposit-intent Edge Function, which reads the SERVER-AUTHORITATIVE
// deposit amount and creates a Stripe PaymentIntent. We only send the eventId;
// the client never states an amount. Returns the PaymentIntent client secret
// for the Stripe payment UI to confirm, plus the authoritative amount (in
// cents) for display confirmation.
export type DepositIntent = {
  clientSecret: string;
  amountCents: number;
};

export async function createDepositIntent(eventId: string): Promise<{
  data: DepositIntent | null;
  error: string | null;
}> {
  // supabase.functions.invoke automatically attaches the logged-in user's
  // access token as the Authorization header, which the function requires to
  // verify the caller owns the event.
  const { data, error } = await supabase.functions.invoke('create-deposit-intent', {
    body: { eventId },
  });

  if (error) return { data: null, error: error.message };
  if (!data?.clientSecret || typeof data.amountCents !== 'number') {
    return { data: null, error: 'The deposit could not be started. Please try again.' };
  }

  return {
    data: { clientSecret: data.clientSecret, amountCents: data.amountCents },
    error: null,
  };
}
