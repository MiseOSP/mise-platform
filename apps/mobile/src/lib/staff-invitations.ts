// Staff invitations data-access boundary (ADR 0002; v2.0 Sections 18, 52, 65).
//
// Owners/admins pre-assign a chef/manager/admin role by email BEFORE the person
// signs up. The signup trigger (migration 032) provisions the invited role on
// first login. Only org admins/owners can read or write these rows; server-side
// RLS (staff_invitations_*_admin policies) still governs all access regardless
// of what the UI shows (Section 65).
import { supabase } from './supabase';
import { defaultOrganizationId } from './config';

type Result<T> = { data: T | null; error: string | null };

// Roles an admin may invite. 'client' is excluded: clients self-serve at signup.
export type StaffRole = 'owner' | 'admin' | 'manager' | 'chef';

export type StaffInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'revoked'
  | 'expired';

export type StaffInvitation = {
  id: string;
  organizationId: string;
  email: string;
  roleName: StaffRole;
  status: StaffInvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

function mapInvitation(row: any): StaffInvitation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    roleName: row.role_name,
    status: row.status,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at ?? null,
    createdAt: row.created_at,
  };
}

// List invitations for the org, newest first. RLS returns rows only to admins.
export async function listStaffInvitations(
  organizationId: string = defaultOrganizationId
): Promise<Result<StaffInvitation[]>> {
  const { data, error } = await supabase
    .from('staff_invitations')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: (data ?? []).map(mapInvitation), error: null };
}

// Create a pending invitation for an email + role. The DB unique index prevents
// duplicate live pending invites for the same email in the same org.
export async function createStaffInvitation(
  email: string,
  roleName: StaffRole,
  organizationId: string = defaultOrganizationId
): Promise<Result<StaffInvitation> & { emailError?: string | null }> {
  const normalized = email.trim().toLowerCase();

  if (normalized.length === 0) {
    return { data: null, error: 'Email is required.' };
  }

  const { data, error } = await supabase
    .from('staff_invitations')
    .insert({
      organization_id: organizationId,
      email: normalized,
      role_name: roleName,
    })
    .select('*')
    .single();

  if (error) return { data: null, error: error.message };

  const invitation = mapInvitation(data);

  // Best-effort: send the built-in Supabase invitation email. The DB row is the
  // source of truth, so if email delivery fails we still return the recorded
  // invitation and surface emailError so the UI can warn the admin.
  const { data: sendData, error: sendError } = await supabase.functions.invoke(
    'send-staff-invite',
    {
      body: {
        email: invitation.email,
        roleName: invitation.roleName,
        organizationId: invitation.organizationId,
      },
    }
  );

  const emailError =
    sendError?.message ??
    (sendData && (sendData as { error?: string }).error) ??
    null;

  return { data: invitation, error: null, emailError };
}

// Revoke a still-pending invitation so it can no longer be redeemed at signup.
export async function revokeStaffInvitation(
  id: string
): Promise<Result<StaffInvitation>> {
  const { data, error } = await supabase
    .from('staff_invitations')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapInvitation(data), error: null };
}
