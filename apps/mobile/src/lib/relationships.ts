import { supabase } from './supabase';

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
  organizationId: string;
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

// Create a Relationship from a public inquiry. Every inquiry starts a
// relationship (v2.0 Section 9). This writes the relationship plus a primary
// contact. It does NOT create a user account or any charge.
export async function createInquiryRelationship(
  input: NewInquiry,
): Promise<Result<Relationship>> {
  const { data: rel, error: relErr } = await supabase
    .from('relationships')
    .insert({
      organization_id: input.organizationId,
      relationship_type: input.relationshipType ?? 'individual',
      display_name: input.displayName,
      referral_source: input.referralSource ?? null,
      lead_status: 'inquiry',
      client_status: 'prospect',
      important_notes: input.notes ?? null,
      last_interaction_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (relErr) return { data: null, error: relErr.message };

  const c = input.contact;
  if (c && (c.firstName || c.lastName || c.email || c.phone)) {
    const { error: contactErr } = await supabase
      .from('relationship_contacts')
      .insert({
        relationship_id: rel.id,
        is_primary: true,
        first_name: c.firstName ?? null,
        last_name: c.lastName ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
      });
    // A contact failure should not orphan the relationship silently; surface it.
    if (contactErr) return { data: mapRow(rel), error: contactErr.message };
  }

  return { data: mapRow(rel), error: null };
}
