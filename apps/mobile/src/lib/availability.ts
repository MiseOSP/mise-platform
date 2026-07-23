import { supabase } from './supabase';

// Chef Portal availability management (spec S91/S102 "Manage availability").
// A chef declares which weekdays they are generally available, with an optional time
// window and note. RLS (migration 036) restricts every write to the chef's OWN rows.
// This is advisory scheduling input; admins still assign events manually in the MVP (S15).

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type AvailabilitySlot = {
  id: string;
  weekday: number;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
};

// Resolves the signed-in user's own chef_profiles row (id + org) for the current org.
// Returns null if the user is not a chef in this organization.
export async function fetchMyChefProfile(
  organizationId: string
): Promise<{ chefProfileId: string; organizationId: string } | null> {
  const { data: auth } = await supabase.auth.getUser();
  const authId = auth?.user?.id;
  if (!authId) return null;

  const { data: appUser, error: userErr } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .maybeSingle();
  if (userErr) throw userErr;
  if (!appUser) return null;

  const { data: profile, error: profErr } = await supabase
    .from('chef_profiles')
    .select('id, organization_id')
    .eq('organization_id', organizationId)
    .eq('user_id', appUser.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (profErr) throw profErr;
  if (!profile) return null;

  return { chefProfileId: profile.id as string, organizationId: profile.organization_id as string };
}

// Lists the chef's own availability slots, ordered Sunday..Saturday.
export async function fetchMyAvailability(chefProfileId: string): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase
    .from('chef_availability')
    .select('id, weekday, start_time, end_time, note')
    .eq('chef_id', chefProfileId)
    .is('deleted_at', null)
    .order('weekday', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    weekday: (row.weekday as number) ?? 0,
    startTime: (row.start_time as string) ?? null,
    endTime: (row.end_time as string) ?? null,
    note: (row.note as string) ?? null,
  }));
}

// Marks a weekday available by inserting a slot. Ownership is enforced by RLS.
export async function addAvailability(
  organizationId: string,
  chefProfileId: string,
  weekday: Weekday
): Promise<void> {
  const { error } = await supabase.from('chef_availability').insert({
    organization_id: organizationId,
    chef_id: chefProfileId,
    weekday,
  });
  if (error) throw error;
}

// Removes an availability slot (marks that weekday not available).
export async function removeAvailability(slotId: string): Promise<void> {
  const { error } = await supabase.from('chef_availability').delete().eq('id', slotId);
  if (error) throw error;
}
