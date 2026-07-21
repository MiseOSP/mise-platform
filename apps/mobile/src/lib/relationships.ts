import { supabase } from './supabase';
import { defaultOrganizationId, functionsBaseUrl, supabaseAnonKey } from './config';

// Relationship domain layer (v2.0 Sections 9, 16, 19).
// A Relationship is the enduring client record, created at first inquiry and
// not requiring a user account. This module is the typed data-access boundary
// for relationships; presentation components should call these functions
// rather than querying Supabase directly (v2.0 Section 52).

export type RelationshipType = 'household' | 'business' | 'individual';
export type LeadStatus = 'inquiry' | 'qualifying' | 'active' | 'dormant' | 'lost';
export type ClientStatus = 'prospect' | 'one_time' | 'member' | 'former';

export type Relationship = {
  id: string;
  organizationId: string;
  relationshipType: RelationshipType;
  displayName: string;
  leadStatus: LeadStatus;
  clientStatus: ClientStatus;
  referralSource: string | null;
  lifetimeValueCents: number;
  currency: string;
  importantNotes: string | null;
  lastInteractionAt: string | null;
  createdAt: string;
};

export type NewInquiry = {
  organizationId?: string;
  relationshipType?: RelationshipType;
  displayName: string;
  referralSource?: string | null;
  contact: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  notes?: string | null;
};

type Result<T> = { data: T | null; error: string | null };

function mapRow(row: Record<string, unknown>): Relationship {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    relationshipType: row.relationship_type as RelationshipType,
    displayName: row.display_name as string,
    leadStatus: row.lead_status as LeadStatus,
    clientStatus: row.client_status as ClientStatus,
    referralSource: (row.referral_source as string) ?? null,
    lifetimeValueCents: Number(row.lifetime_value_cents ?? 0),
    currency: (row.currency as string) ?? 'usd',
    importantNotes: (row.important_notes as string) ?? null,
    lastInteractionAt: (row.last_interaction_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// List relationships for an organization (staff view). RLS enforces access.
export async function listRelationships(
  organizationId: string,
): Promise<Result<Relationship[]>> {
  const { data, error } = await supabase
    .from('relationships')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('last_interaction_at', { ascending: false, nullsFirst: false });

  if (error) return { data: null, error: error.message };
  return { data: (data ?? []).map(mapRow), error: null };
}

export async function getRelationship(id: string): Promise<Result<Relationship>> {
  const { data, error } = await supabase
    .from('relationships')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  return { data: mapRow(data), error: null };
}

// Create a Relationship from a PUBLIC inquiry (v2.0 Sections 9, 18).
//
// The public intake path is UNAUTHENTICATED, so it cannot write to the
// relationships / relationship_contacts tables directly: RLS (migration 021)
// grants INSERT only to org admins, and loosening that for the anon role would
// expose the CRM to abuse (v2.0 Sections 51, 60, 65, 98). Instead we POST to
// the 'public-inquiry' Edge Function, which validates input and inserts using
// trusted server authority. The anon caller cannot read the created row back
// (RLS), so we return a lightweight Relationship built from the input plus the
// server-issued id; staff see the full record in the admin CRM.
export async function createInquiryRelationship(
  input: NewInquiry,
): Promise<Result<Relationship>> {
  const organizationId = input.organizationId ?? defaultOrganizationId;

  if (!functionsBaseUrl || !supabaseAnonKey) {
    return { data: null, error: 'App is not configured to submit inquiries yet.' };
  }
  if (!organizationId) {
    return { data: null, error: 'Missing organization configuration for this inquiry.' };
  }

  let res: Response;
  try {
    res = await fetch(`${functionsBaseUrl}/public-inquiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        organizationId,
        relationshipType: input.relationshipType,
        displayName: input.displayName,
        referralSource: input.referralSource ?? null,
        contact: input.contact,
        notes: input.notes ?? null,
      }),
    });
  } catch {
    return { data: null, error: 'Could not reach the server. Please try again.' };
  }

  let payload: { id?: string; error?: string } = {};
  try {
    payload = await res.json();
  } catch {
    // fall through to status-based handling
  }

  if (!res.ok || !payload.id) {
    return { data: null, error: payload.error ?? 'Could not submit your inquiry.' };
  }

  const now = new Date().toISOString();
  const relationship: Relationship = {
    id: payload.id,
    organizationId,
    relationshipType: input.relationshipType ?? 'individual',
    displayName: input.displayName,
    leadStatus: 'inquiry',
    clientStatus: 'prospect',
    referralSource: input.referralSource ?? null,
    lifetimeValueCents: 0,
    currency: 'usd',
    importantNotes: input.notes ?? null,
    lastInteractionAt: now,
    createdAt: now,
  };
  return { data: relationship, error: null };
}
