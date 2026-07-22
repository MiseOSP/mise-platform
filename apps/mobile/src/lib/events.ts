import { supabase } from './supabase';
import type { OrgRole } from '../contexts/auth-context';

// Common shape the Home screen renders, regardless of which query produced
// it (management/client query the base `events` table; chef queries the
// masked `chef_visible_events` view).
export type EventListItem = {
  id: string;
  status: string;
  event_date: string;
  start_time: string | null;
  guest_count: number | null;
  occasion: string | null;
  city: string | null;
  state: string | null;
  address: string | null; // null for chefs until 15h before the event
  assignment_status?: string;
  assignmentId?: string;
  chefFee?: number | null;
  foodCostEstimate?: number | null;
};

export async function fetchEventsForRole(
  role: OrgRole,
  organizationId: string
): Promise<{ data: EventListItem[]; error: string | null }> {
  if (role === 'chef') {
    const { data, error } = await supabase
      .from('chef_visible_events')
      .select(
        'id, status, event_date, start_time, guest_count, occasion, city, state, visible_address, assignment_status, assignment_id'
      )
      .order('event_date', { ascending: true });

    if (error) return { data: [], error: error.message };
    return {
      data: (data ?? []).map((e) => ({
        id: e.id,
        status: e.status,
        event_date: e.event_date,
        start_time: e.start_time,
        guest_count: e.guest_count,
        occasion: e.occasion,
        city: e.city,
        state: e.state,
        address: e.visible_address,
        assignment_status: e.assignment_status,
        assignmentId: e.assignment_id,
      })),
      error: null,
    };
  }

  // owner/admin/manager see every event in the org; client sees only their
  // own (enforced server-side by RLS either way -- this query is the same
  // shape for both, the database does the filtering).
  const { data, error } = await supabase
    .from('events')
    .select('id, status, event_date, start_time, guest_count, occasion, city, state, address, service_fee, food_cost_estimate')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('event_date', { ascending: true });

  if (error) return { data: [], error: error.message };
  const items = (data ?? []).map((e: any) => ({
      ...e,
      chefFee: e.service_fee ?? null,
      foodCostEstimate: e.food_cost_estimate ?? null,
    }));
    return { data: items as EventListItem[], error: null };
}

export type CreateEventInput = {
  organizationId: string;
  clientEmail: string;
  eventDate: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  guestCount?: number;
  occasion?: string;
  address?: string;
  city?: string;
  state?: string;
  experienceId?: string;
  chefFee?: number;
  foodCostEstimate?: number;
};

// Creates an event for an existing client (looked up via client_profiles ->
// users.email, scoped to this organization). Requires the client to already
// have a client_profiles row -- use addClientByEmail (lib/clients.ts) first
// if they don't.
export async function createEvent(input: CreateEventInput): Promise<void> {
  const trimmedEmail = input.clientEmail.trim().toLowerCase();

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', trimmedEmail)
    .maybeSingle();
  if (userError) throw userError;
  if (!user) throw new Error(`No account found for ${trimmedEmail}.`);

  const { data: clientProfile, error: clientError } = await supabase
    .from('client_profiles')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (clientError) throw clientError;
  if (!clientProfile) {
    throw new Error(`${trimmedEmail} is not a client of this organization yet. Add them as a client first.`);
  }

  const { error: insertError } = await supabase.from('events').insert({
    organization_id: input.organizationId,
    client_id: clientProfile.id,
    event_date: input.eventDate,
    start_time: input.startTime || null,
    guest_count: input.guestCount ?? null,
    occasion: input.occasion || null,
    experience_id: input.experienceId || null,
    address: input.address || null,
    city: input.city || null,
    state: input.state || null,
    service_fee: input.chefFee ?? null,
    food_cost_estimate: input.foodCostEstimate ?? null,
  });
  if (insertError) throw insertError;
}

// Fetches a single event from the chef-safe `chef_visible_events` view by id.
// Returns the same masked shape as the chef branch of fetchEventsForRole
// (address stays null until ~15h before the event; no internal notes). RLS on
// the underlying view restricts this to the chef's own assigned events
// (migration 005). Used by the chef event-detail screen (Phase 5, spec S91).
export async function fetchChefVisibleEvent(
  eventId: string
): Promise<{ data: EventListItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from('chef_visible_events')
    .select(
      'id, status, event_date, start_time, guest_count, occasion, city, state, visible_address, assignment_status, assignment_id'
    )
    .eq('id', eventId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  return {
    data: {
      id: data.id,
      status: data.status,
      event_date: data.event_date,
      start_time: data.start_time,
      guest_count: data.guest_count,
      occasion: data.occasion,
      city: data.city,
      state: data.state,
      address: data.visible_address,
      assignment_status: data.assignment_status,
      assignmentId: data.assignment_id,
    },
    error: null,
  };
}
