// public-inquiry Edge Function
//
// Accepts a public (unauthenticated) inquiry and creates the enduring
// Relationship record plus its primary contact, server-side, using the
// service-role client. This is the trusted write boundary for public intake:
// the relationships / relationship_contacts tables intentionally grant INSERT
// only to org admins via RLS (migration 021), so anonymous browsers must NOT
// write to them directly. This function is the only public entry point.
//
// v2.0 references:
//   Section 9  - every inquiry creates a Relationship
//   Section 18 - a person may inquire without an account
//   Section 33 - public intake fields
//   Section 51/60/65 - security-sensitive writes enforced server-side
//   Section 77 - all external input is runtime-validated
//
// Deploy (JWT verification MUST be off so anonymous clients can call it):
//   supabase functions deploy public-inquiry --no-verify-jwt
// Required function env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const RELATIONSHIP_TYPES = new Set(['household', 'business', 'individual']);
const MAX = { name: 200, email: 320, phone: 40, text: 4000, referral: 200 };

type InquiryBody = {
  organizationId?: unknown;
  relationshipType?: unknown;
  displayName?: unknown;
  referralSource?: unknown;
  contact?: {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    phone?: unknown;
  };
  notes?: unknown;
};

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function isUuid(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return bad('Method not allowed', 405);

  let body: InquiryBody;
  try {
    body = await req.json();
  } catch {
    return bad('Invalid JSON body');
  }

  // organizationId is required and must be a real UUID; the client passes the
  // configured public org id. We do NOT trust it beyond shape + existence.
  if (!isUuid(body.organizationId)) return bad('A valid organizationId is required');

  const displayName = str(body.displayName, MAX.name);
  const email = str(body.contact?.email, MAX.email);
  const phone = str(body.contact?.phone, MAX.phone);
  const firstName = str(body.contact?.firstName, MAX.name);
  const lastName = str(body.contact?.lastName, MAX.name);

  // Need something to identify the person: a name, or an email/phone.
  if (!displayName && !firstName && !lastName && !email && !phone) {
    return bad('Please include a name and a way to reach you');
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return bad('Please provide a valid email address');
  }

  let relationshipType = 'individual';
  if (typeof body.relationshipType === 'string' && RELATIONSHIP_TYPES.has(body.relationshipType)) {
    relationshipType = body.relationshipType;
  }

  const resolvedName =
    displayName ??
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    email ||
    phone ||
    'New inquiry';

  // Confirm the org exists (avoids planting orphan rows from a bad config).
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', body.organizationId)
    .is('deleted_at', null)
    .maybeSingle();
  if (orgErr) {
    console.error('public-inquiry org lookup failed', orgErr);
    return bad('Could not process inquiry', 500);
  }
  if (!org) return bad('Unknown organization');

  const { data: rel, error: relErr } = await supabase
    .from('relationships')
    .insert({
      organization_id: body.organizationId,
      relationship_type: relationshipType,
      display_name: resolvedName,
      referral_source: str(body.referralSource, MAX.referral),
      lead_status: 'inquiry',
      client_status: 'prospect',
      important_notes: str(body.notes, MAX.text),
      first_inquiry_at: new Date().toISOString(),
      last_interaction_at: new Date().toISOString(),
    })
    .select('id, display_name, relationship_type, lead_status, client_status, created_at')
    .single();

  if (relErr) {
    console.error('public-inquiry relationship insert failed', relErr);
    return bad('Could not create inquiry', 500);
  }

  if (firstName || lastName || email || phone) {
    const { error: contactErr } = await supabase.from('relationship_contacts').insert({
      relationship_id: rel.id,
      is_primary: true,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
    });
    if (contactErr) {
      // The relationship exists; a missing contact is recoverable by staff.
      console.error('public-inquiry contact insert failed', contactErr);
    }
  }

  return new Response(
    JSON.stringify({ id: rel.id, status: 'received' }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
