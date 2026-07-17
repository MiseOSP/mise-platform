import { supabase } from './supabase';

export type AddClientInput = {
  organizationId: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
};

// Creates a client_profiles row for an existing signed-up user (looked up by
// email in the app-level `users` table). NOTE: same limitation as adding a
// team member -- the client must have already created an account. A proper
// "invite a client who has no account yet" flow needs a service-role Edge
// Function (see supabase/functions/README.md) and is a follow-up.
export async function addClientByEmail({ organizationId, email, address, city, state }: AddClientInput) {
  const trimmedEmail = email.trim().toLowerCase();

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', trimmedEmail)
    .maybeSingle();

  if (userError) throw userError;
  if (!user) {
    throw new Error(`No account found for ${trimmedEmail}. They need to sign up first.`);
  }

  const { error: insertError } = await supabase.from('client_profiles').insert({
    organization_id: organizationId,
    user_id: user.id,
    address: address || null,
    city: city || null,
    state: state || null,
  });

  if (insertError) throw insertError;
}
