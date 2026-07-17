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
};

export async function fetchEventsForRole(
  role: OrgRole,
  organizationId: string
): Promise<{ data: EventListItem[]; error: string | null }> {
  if (role === 'chef') {
    const { data, error } = await supabase
      .from('chef_visible_events')
      .select(
        'id, status, event_date, start_time, guest_count, occasion, city, state, visible_address, assignment_status'
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
      })),
      error: null,
    };
  }

  // owner/admin/manager see every event in the org; client sees only their
  // own (enforced server-side by RLS either way -- this query is the same
  // shape for both, the database does the filtering).
  const { data, error } = await supabase
    .from('events')
    .select('id, status, event_date, start_time, guest_count, occasion, city, state, address')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('event_date', { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as EventListItem[], error: null };
}
