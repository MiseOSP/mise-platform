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
