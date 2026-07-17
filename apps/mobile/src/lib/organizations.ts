import { supabase } from './supabase';

export type CreateOrganizationInput = {
  authId: string;
  email: string | null;
  organizationName: string;
};

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return base.length > 0 ? base : `org-${Date.now()}`;
}

// Ensures a row exists in the app-level `users` table for the given Supabase
// Auth identity, and returns its id. `users.id` (not the auth id) is what the
// rest of the schema (organization_members, profiles, etc.) references.
async function ensureUserRecord(authId: string, email: string | null): Promise<string> {
  const { data: existing, error: lookupError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing) return existing.id as string;

  const { data: inserted, error: insertError } = await supabase
    .from('users')
    .insert({ auth_id: authId, email })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return inserted.id as string;
}

// Creates a brand-new organization and makes the current authenticated user
// its owner. Used by the onboarding screen for a signed-in user with no
// existing organization_members row.
export async function createOrganizationForCurrentUser({
  authId,
  email,
  organizationName,
}: CreateOrganizationInput): Promise<string> {
  const trimmedName = organizationName.trim();
  if (trimmedName.length < 2) {
    throw new Error('Organization name must be at least 2 characters.');
  }

  const userId = await ensureUserRecord(authId, email);

  const { data: ownerRole, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'owner')
    .single();

  if (roleError || !ownerRole) {
    throw new Error(
      'The "owner" system role was not found. Run supabase/migrations/002_seed_roles.sql against this project first.'
    );
  }

  const baseSlug = slugify(trimmedName);
  let slug = baseSlug;

  for (let attempt = 0; attempt <= 5; attempt += 1) {
    if (attempt > 0) slug = `${baseSlug}-${attempt}`;

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: trimmedName, slug })
      .select('id')
      .single();

    if (orgError) {
      // 23505 = unique_violation (slug collision) -> retry with a suffix.
      if (orgError.code === '23505' && attempt < 5) continue;
      throw orgError;
    }

    const { error: memberError } = await supabase.from('organization_members').insert({
      organization_id: org.id,
      user_id: userId,
      role_id: ownerRole.id,
    });

    if (memberError) throw memberError;

    return org.id as string;
  }

  throw new Error('Could not create organization: too many slug collisions.');
}

export async function fetchTeamSize(
  organizationId: string
): Promise<{ count: number; error: string | null }> {
  const { count, error } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .is('deleted_at', null);

  if (error) return { count: 0, error: error.message };
  return { count: count ?? 0, error: null };
}
