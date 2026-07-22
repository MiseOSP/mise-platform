// NCS Reserve data-access boundary (v2.0 Sections 10, 20, 39, 52, 89).
//
// A Membership is an OPTIONAL recurring commercial arrangement attached to a
// Relationship (the enduring client record). Per ADR 0001 / migration 022,
// Reserve does NOT use prepaid credits: the platform is free to explore and
// money is only collected when an actual Event is booked. Recurring schedules
// PROPOSE events; they never auto-charge. Schedule/pause/cancel changes route
// to an admin in the MVP rather than mutating state directly (Section 39).
//
// Presentation components should call these functions rather than querying
// Supabase directly (Section 52). Server-side RLS still governs all access.
import { supabase } from './supabase';
import { defaultOrganizationId } from './config';

type Result<T> = { data: T | null; error: string | null };

export type MemberType = 'household' | 'business';
export type MembershipStatus =
  | 'draft'
  | 'proposed'
  | 'active'
  | 'paused'
  | 'past_due'
  | 'canceled'
  | 'completed';
export type RecurringFeeInterval = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
export type ReserveInterestStatus =
  | 'new'
  | 'contacted'
  | 'consult_scheduled'
  | 'converted'
  | 'closed';

export type MembershipPlan = {
  id: string;
  organizationId: string;
  name: string;
  memberType: MemberType;
  recurringFeeInterval: RecurringFeeInterval | null;
  basePriceCents: number | null;
  includedBenefits: string[];
  cancellationPolicy: string | null;
  reschedulingPolicy: string | null;
  active: boolean;
};

export type Membership = {
  id: string;
  organizationId: string;
  relationshipId: string | null;
  planId: string;
  status: MembershipStatus;
  preferredDayOfWeek: number | null;
  preferredServiceWindow: string | null;
  startDate: string | null;
  nextBillingDate: string | null;
  pausedAt: string | null;
  resumesAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
};

export type ReserveInterest = {
  id: string;
  organizationId: string;
  relationshipId: string | null;
  desiredCadence: string | null;
  preferredDayOfWeek: number | null;
  notes: string | null;
  status: ReserveInterestStatus;
  createdAt: string;
};

function mapPlan(row: Record<string, unknown>): MembershipPlan {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    memberType: row.member_type as MemberType,
    recurringFeeInterval: (row.recurring_fee_interval as RecurringFeeInterval) ?? null,
    basePriceCents: row.base_price == null ? null : Number(row.base_price),
    includedBenefits: (row.included_benefits as string[]) ?? [],
    cancellationPolicy: (row.cancellation_policy as string) ?? null,
    reschedulingPolicy: (row.rescheduling_policy as string) ?? null,
    active: Boolean(row.active),
  };
}

function mapMembership(row: Record<string, unknown>): Membership {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    relationshipId: (row.relationship_id as string) ?? null,
    planId: row.plan_id as string,
    status: row.status as MembershipStatus,
    preferredDayOfWeek: row.preferred_day_of_week == null ? null : Number(row.preferred_day_of_week),
    preferredServiceWindow: (row.preferred_service_window as string) ?? null,
    startDate: (row.start_date as string) ?? null,
    nextBillingDate: (row.next_billing_date as string) ?? null,
    pausedAt: (row.paused_at as string) ?? null,
    resumesAt: (row.resumes_at as string) ?? null,
    cancelledAt: (row.cancelled_at as string) ?? null,
    cancellationReason: (row.cancellation_reason as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapReserveInterest(row: Record<string, unknown>): ReserveInterest {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    relationshipId: (row.relationship_id as string) ?? null,
    desiredCadence: (row.desired_cadence as string) ?? null,
    preferredDayOfWeek:
      row.preferred_day_of_week == null ? null : Number(row.preferred_day_of_week),
    notes: (row.notes as string) ?? null,
    status: row.status as ReserveInterestStatus,
    createdAt: row.created_at as string,
  };
}

// List the active membership plans on offer for an organization (Section 10).
export async function listPlans(
  organizationId: string = defaultOrganizationId,
): Promise<Result<MembershipPlan[]>> {
  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: (data ?? []).map(mapPlan), error: null };
}

// The current (non-terminal) membership attached to a relationship, if any.
export async function getMembershipForRelationship(
  relationshipId: string,
): Promise<Result<Membership | null>> {
  const { data, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('relationship_id', relationshipId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data ? mapMembership(data) : null, error: null };
}

export type ReserveInterestInput = {
  relationshipId?: string | null;
  desiredCadence?: string | null;
  preferredDayOfWeek?: number | null;
  notes?: string | null;
  organizationId?: string;
};

// Capture a lightweight Reserve lead (Section 39/89). This does NOT create a
// membership or any charge; it routes interest to an admin for consultation.
export async function createReserveInterest(
  input: ReserveInterestInput,
): Promise<Result<ReserveInterest>> {
  const { data, error } = await supabase
    .from('reserve_interests')
    .insert({
      organization_id: input.organizationId ?? defaultOrganizationId,
      relationship_id: input.relationshipId ?? null,
      desired_cadence: input.desiredCadence ?? null,
      preferred_day_of_week: input.preferredDayOfWeek ?? null,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapReserveInterest(data), error: null };
}

// Pure helper: given an ISO date (YYYY-MM-DD) and a target weekday (0=Sun..6=Sat),
// return the ISO date of the next occurrence of that weekday on or after `from`.
// Used to show a member their upcoming recurring visit without server round-trips.
// Reserve automation stays conservative (Section 89): this only DISPLAYS a
// proposed date; it never books or charges.
export function nextOccurrenceOnOrAfter(from: string, weekday: number): string {
  const base = new Date(`${from}T00:00:00Z`);
  const current = base.getUTCDay();
  const delta = (((weekday - current) % 7) + 7) % 7;
  const next = new Date(base);
  next.setUTCDate(base.getUTCDate() + delta);
  return next.toISOString().slice(0, 10);
}

// --- Staff-facing reserve interest management (Section 10 / Phase 3) ---
// These power the internal NCS Reserve queue: staff (admin/chef) review
// incoming interest, add notes during a consult, and advance the status
// through the pipeline. RLS (migration 022 reserve_interests_manage_staff)
// restricts these writes to org admins on the server; the app only surfaces
// them to staff roles.

// List reserve interests for an organization, newest first.
export async function listReserveInterests(
  organizationId: string,
): Promise<Result<ReserveInterest[]>> {
  const { data, error } = await supabase
    .from('reserve_interests')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: (data ?? []).map(mapReserveInterest), error: null };
}

// Update the free-text notes on a reserve interest (e.g. consult summary).
export async function updateReserveInterestNotes(
  id: string,
  notes: string | null,
): Promise<Result<ReserveInterest>> {
  const { data, error } = await supabase
    .from('reserve_interests')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapReserveInterest(data), error: null };
}

// Advance a reserve interest through the pipeline
// (new -> contacted -> consult_scheduled -> converted / closed).
export async function updateReserveInterestStatus(
  id: string,
  status: ReserveInterestStatus,
): Promise<Result<ReserveInterest>> {
  const { data, error } = await supabase
    .from('reserve_interests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapReserveInterest(data), error: null };
}
