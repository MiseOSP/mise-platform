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

// ---------------------------------------------------------------------------
// Phase 3 / ADR 0003 — plan management, proposals, activation, change requests
// ---------------------------------------------------------------------------
// Billing is configurable per plan (membership_plans.billing_model) but only
// 'per_event' is activatable in this release; 'recurring_fee' and 'hybrid' are
// selectable-but-"coming soon". Activation and status transitions are enforced
// server-side by migration 033 (Section 51); these functions surface, not
// replace, that authority.

export type BillingModel = 'per_event' | 'recurring_fee' | 'hybrid';

// The only billing model that can be ACTIVATED in the Nashville MVP (ADR 0003).
export const ACTIVATABLE_BILLING_MODELS: BillingModel[] = ['per_event'];

export function isActivatableBillingModel(model: BillingModel): boolean {
  return ACTIVATABLE_BILLING_MODELS.includes(model);
}

export type ChangeRequestType =
  | 'pause'
  | 'resume'
  | 'reschedule'
  | 'cancel'
  | 'concierge'
  | 'other';
export type ChangeRequestStatus = 'open' | 'in_review' | 'resolved' | 'declined';

export type MembershipChangeRequest = {
  id: string;
  organizationId: string;
  membershipId: string;
  requestType: ChangeRequestType;
  message: string | null;
  status: ChangeRequestStatus;
  requestedBy: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  adminNote: string | null;
  createdAt: string;
};

function mapChangeRequest(row: Record<string, unknown>): MembershipChangeRequest {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    membershipId: row.membership_id as string,
    requestType: row.request_type as ChangeRequestType,
    message: (row.message as string) ?? null,
    status: row.status as ChangeRequestStatus,
    requestedBy: (row.requested_by as string) ?? null,
    resolvedBy: (row.resolved_by as string) ?? null,
    resolvedAt: (row.resolved_at as string) ?? null,
    adminNote: (row.admin_note as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// Read the billing_model of a plan (not exposed by the trimmed MembershipPlan).
export async function getPlanBillingModel(
  planId: string,
): Promise<Result<BillingModel>> {
  const { data, error } = await supabase
    .from('membership_plans')
    .select('billing_model')
    .eq('id', planId)
    .single();
  if (error) return { data: null, error: error.message };
  return { data: (data?.billing_model as BillingModel) ?? 'per_event', error: null };
}

// --- Admin: plan management (Section 89) ---
export type PlanInput = {
  name: string;
  memberType: MemberType;
  billingModel?: BillingModel;
  recurringFeeInterval?: RecurringFeeInterval | null;
  basePriceCents?: number | null;
  includedBenefits?: string[];
  cancellationPolicy?: string | null;
  reschedulingPolicy?: string | null;
  active?: boolean;
  organizationId?: string;
};

export async function createPlan(input: PlanInput): Promise<Result<MembershipPlan>> {
  const { data, error } = await supabase
    .from('membership_plans')
    .insert({
      organization_id: input.organizationId ?? defaultOrganizationId,
      name: input.name,
      member_type: input.memberType,
      billing_model: input.billingModel ?? 'per_event',
      recurring_fee_interval: input.recurringFeeInterval ?? null,
      base_price: input.basePriceCents ?? 0,
      included_benefits: input.includedBenefits ?? [],
      cancellation_policy: input.cancellationPolicy ?? null,
      rescheduling_policy: input.reschedulingPolicy ?? null,
      active: input.active ?? true,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: mapPlan(data), error: null };
}

export async function updatePlan(
  id: string,
  patch: Partial<PlanInput>,
): Promise<Result<MembershipPlan>> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.memberType !== undefined) row.member_type = patch.memberType;
  if (patch.billingModel !== undefined) row.billing_model = patch.billingModel;
  if (patch.recurringFeeInterval !== undefined)
    row.recurring_fee_interval = patch.recurringFeeInterval;
  if (patch.basePriceCents !== undefined) row.base_price = patch.basePriceCents;
  if (patch.includedBenefits !== undefined) row.included_benefits = patch.includedBenefits;
  if (patch.cancellationPolicy !== undefined)
    row.cancellation_policy = patch.cancellationPolicy;
  if (patch.reschedulingPolicy !== undefined)
    row.rescheduling_policy = patch.reschedulingPolicy;
  if (patch.active !== undefined) row.active = patch.active;

  const { data, error } = await supabase
    .from('membership_plans')
    .update(row)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: mapPlan(data), error: null };
}

// List ALL plans for admin (including inactive), newest first.
export async function listAllPlans(
  organizationId: string = defaultOrganizationId,
): Promise<Result<MembershipPlan[]>> {
  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []).map(mapPlan), error: null };
}

// --- Admin: memberships (Section 89) ---
export async function listMemberships(
  organizationId: string = defaultOrganizationId,
): Promise<Result<Membership[]>> {
  const { data, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []).map(mapMembership), error: null };
}

// Create a PROPOSED membership for a relationship's client profile. The row
// starts in 'proposed'; activation is a separate, server-guarded step.
export type MembershipProposalInput = {
  clientProfileId: string;
  relationshipId: string;
  planId: string;
  preferredDayOfWeek?: number | null;
  preferredServiceWindow?: string | null;
  organizationId?: string;
};

export async function createMembershipProposal(
  input: MembershipProposalInput,
): Promise<Result<Membership>> {
  const { data, error } = await supabase
    .from('memberships')
    .insert({
      organization_id: input.organizationId ?? defaultOrganizationId,
      client_id: input.clientProfileId,
      relationship_id: input.relationshipId,
      plan_id: input.planId,
      status: 'proposed',
      preferred_day_of_week: input.preferredDayOfWeek ?? null,
      preferred_service_window: input.preferredServiceWindow ?? null,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: mapMembership(data), error: null };
}

// Transition a membership's status. The DB (migration 033) validates the
// transition graph and the per_event activation gate; illegal moves error.
export async function setMembershipStatus(
  id: string,
  status: MembershipStatus,
  extra?: { cancellationReason?: string | null; resumesAt?: string | null },
): Promise<Result<Membership>> {
  const row: Record<string, unknown> = { status };
  if (extra?.cancellationReason !== undefined)
    row.cancellation_reason = extra.cancellationReason;
  if (extra?.resumesAt !== undefined) row.resumes_at = extra.resumesAt;

  const { data, error } = await supabase
    .from('memberships')
    .update(row)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: mapMembership(data), error: null };
}

// Convenience wrappers for the common transitions.
export const activateMembership = (id: string) => setMembershipStatus(id, 'active');
export const pauseMembership = (id: string, resumesAt?: string | null) =>
  setMembershipStatus(id, 'paused', { resumesAt: resumesAt ?? null });
export const cancelMembership = (id: string, reason?: string | null) =>
  setMembershipStatus(id, 'canceled', { cancellationReason: reason ?? null });

// --- Recurring schedule read (Section 39 upcoming schedule) ---
export type RecurringSchedule = {
  id: string;
  membershipId: string;
  patternType: string;
  dayOfWeek: number | null;
  intervalWeeks: number;
  nextOccurrence: string | null;
  active: boolean;
};

function mapSchedule(row: Record<string, unknown>): RecurringSchedule {
  return {
    id: row.id as string,
    membershipId: row.membership_id as string,
    patternType: row.pattern_type as string,
    dayOfWeek: row.day_of_week == null ? null : Number(row.day_of_week),
    intervalWeeks: row.interval_weeks == null ? 1 : Number(row.interval_weeks),
    nextOccurrence: (row.next_occurrence as string) ?? null,
    active: Boolean(row.active),
  };
}

export async function getScheduleForMembership(
  membershipId: string,
): Promise<Result<RecurringSchedule | null>> {
  const { data, error } = await supabase
    .from('recurring_schedules')
    .select('*')
    .eq('membership_id', membershipId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data ? mapSchedule(data) : null, error: null };
}

// --- Membership change requests (Section 39: route to admin) ---
export async function createChangeRequest(input: {
  membershipId: string;
  requestType: ChangeRequestType;
  message?: string | null;
  organizationId?: string;
}): Promise<Result<MembershipChangeRequest>> {
  const { data, error } = await supabase
    .from('membership_change_requests')
    .insert({
      organization_id: input.organizationId ?? defaultOrganizationId,
      membership_id: input.membershipId,
      request_type: input.requestType,
      message: input.message ?? null,
    })
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: mapChangeRequest(data), error: null };
}

export async function listChangeRequestsForMembership(
  membershipId: string,
): Promise<Result<MembershipChangeRequest[]>> {
  const { data, error } = await supabase
    .from('membership_change_requests')
    .select('*')
    .eq('membership_id', membershipId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []).map(mapChangeRequest), error: null };
}

// Admin queue: all open/in-review requests for an organization.
export async function listOpenChangeRequests(
  organizationId: string = defaultOrganizationId,
): Promise<Result<MembershipChangeRequest[]>> {
  const { data, error } = await supabase
    .from('membership_change_requests')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .in('status', ['open', 'in_review'])
    .order('created_at', { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []).map(mapChangeRequest), error: null };
}

// Admin resolves or declines a change request (does not itself mutate the
// membership; the admin applies any status change separately and deliberately).
export async function resolveChangeRequest(
  id: string,
  status: Extract<ChangeRequestStatus, 'resolved' | 'declined'>,
  adminNote?: string | null,
): Promise<Result<MembershipChangeRequest>> {
  const { data, error } = await supabase
    .from('membership_change_requests')
    .update({
      status,
      admin_note: adminNote ?? null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: mapChangeRequest(data), error: null };
}
