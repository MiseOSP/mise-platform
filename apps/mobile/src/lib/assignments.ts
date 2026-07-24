import { supabase } from './supabase';

export type AssignChefInput = {
  organizationId: string;
  eventId: string;
  chefEmail: string;
  role?: string;
};

// Assigns an existing chef (looked up by email, scoped to this organization) to an event.
// Requires the chef to already have a chef_profiles row in this org -- there is no
// invite-a-new-chef flow here yet (mirrors the addClientByEmail limitation in lib/clients.ts).
export async function assignChefByEmail(input: AssignChefInput): Promise<void> {
  const trimmedEmail = input.chefEmail.trim().toLowerCase();

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', trimmedEmail)
    .maybeSingle();

  if (userError) throw userError;
  if (!user) throw new Error(`No account found for ${trimmedEmail}.`);

  const { data: chefProfile, error: chefError } = await supabase
    .from('chef_profiles')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (chefError) throw chefError;
  if (!chefProfile) {
    throw new Error(`${trimmedEmail} is not a chef in this organization yet.`);
  }

  const { error: insertError } = await supabase.from('event_assignments').insert({
    event_id: input.eventId,
    chef_id: chefProfile.id,
    role: input.role?.trim() || 'lead_chef',
  });

  if (insertError) throw insertError;
}

// Lets a chef accept or decline their own assignment. The event_assignments RLS policy
// restricts this update to the chef's own row, and a trigger further restricts a
// non-management actor to only changing status/accepted_at (see migration 008).
export async function respondToAssignment(assignmentId: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from('event_assignments')
    .update({
      status: accept ? 'accepted' : 'declined',
      accepted_at: accept ? new Date().toISOString() : null,
    })
    .eq('id', assignmentId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Admin/staff read helpers for the chef assignment UI (Phase 4, spec S90).
// These are org-scoped reads; RLS on chef_profiles / event_assignments is the
// real authorization boundary (spec S51/S60 -- UI visibility is not authz).
// ---------------------------------------------------------------------------

export type OrgChef = {
  chefProfileId: string;
  userId: string;
  fullName: string;
  email: string;
  status: string;
  servsafeVerified: boolean;
  insuranceVerified: boolean;
};

// Lists the active chefs in an organization, with their display name/email,
// so an admin can pick from a list instead of typing an email by hand.
export async function listChefsForOrg(organizationId: string): Promise<OrgChef[]> {
  const { data, error } = await supabase
    .from('chef_profiles')
    .select(
      'id, user_id, status, servsafe_verified, insurance_verified, users:user_id ( first_name, last_name, email )'
    )
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('status', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const u = Array.isArray(row.users) ? row.users[0] : row.users;
    const first = u?.first_name?.trim() ?? '';
    const last = u?.last_name?.trim() ?? '';
    const fullName = `${first} ${last}`.trim() || (u?.email ?? 'Unnamed chef');
    return {
      chefProfileId: row.id as string,
      userId: row.user_id as string,
      fullName,
      email: (u?.email as string) ?? '',
      status: (row.status as string) ?? 'pending',
      servsafeVerified: !!row.servsafe_verified,
      insuranceVerified: !!row.insurance_verified,
    };
  });
}

export type EventAssignment = {
  assignmentId: string;
  chefProfileId: string;
  chefName: string;
  chefEmail: string;
  role: string;
  status: string;
  acceptedAt: string | null;
};

// Lists the chefs currently assigned to a single event, newest logic first.
export async function listAssignmentsForEvent(eventId: string): Promise<EventAssignment[]> {
  const { data, error } = await supabase
    .from('event_assignments')
    .select(
      'id, role, status, accepted_at, chef_id, chef_profiles:chef_id ( id, users:user_id ( first_name, last_name, email ) )'
    )
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('role', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const cp = Array.isArray(row.chef_profiles) ? row.chef_profiles[0] : row.chef_profiles;
    const u = cp && (Array.isArray(cp.users) ? cp.users[0] : cp.users);
    const first = u?.first_name?.trim() ?? '';
    const last = u?.last_name?.trim() ?? '';
    const chefName = `${first} ${last}`.trim() || (u?.email ?? 'Chef');
    return {
      assignmentId: row.id as string,
      chefProfileId: (row.chef_id as string) ?? '',
      chefName,
      chefEmail: (u?.email as string) ?? '',
      role: (row.role as string) ?? 'lead_chef',
      status: (row.status as string) ?? 'pending',
      acceptedAt: (row.accepted_at as string) ?? null,
    };
  });
}

// Assigns a chef to an event directly by their chef_profiles id (used when the
// admin picked from the chef list). Mirrors assignChefByEmail's insert.
export async function assignChefById(
  eventId: string,
  chefProfileId: string,
  role?: string
): Promise<void> {
  const { error } = await supabase.from('event_assignments').insert({
    event_id: eventId,
    chef_id: chefProfileId,
    role: role?.trim() || 'lead_chef',
  });
  if (error) throw error;
}

// Soft-removes an assignment (sets deleted_at). Management-only via RLS.
export async function removeAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from('event_assignments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', assignmentId);
  if (error) throw error;
}
