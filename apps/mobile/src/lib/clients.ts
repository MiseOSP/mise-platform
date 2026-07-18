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

export type ClientListItem = {
  id: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lifetimeValue: number;
  notes: string | null;
};

export async function fetchClients(
  organizationId: string
): Promise<{ data: ClientListItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from('client_profiles')
    .select('id, address, city, state, zip, notes, lifetime_value, users:user_id(email, phone)')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((c: any) => ({
      id: c.id,
      email: c.users?.email ?? 'unknown',
      phone: c.users?.phone ?? null,
      address: c.address ?? null,
      city: c.city ?? null,
      state: c.state ?? null,
      zip: c.zip ?? null,
      lifetimeValue: Number(c.lifetime_value ?? 0),
      notes: c.notes ?? null,
    })),
    error: null,
  };
}
