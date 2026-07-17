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
