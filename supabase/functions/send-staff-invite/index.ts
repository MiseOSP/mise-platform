// Sends a Supabase Auth invitation email for a staff invitation that an admin
// has ALREADY recorded via staff-invitations.ts (ADR 0002). The DB row is the
// source of truth; this function only delivers the email side-effect.
//
// Flow: app records staff_invitations row -> app calls this function -> we
// verify the CALLER is an owner/admin of the org and that a matching pending
// invitation exists -> we send the built-in Supabase invite email.
//
// Deploy with: supabase functions deploy send-staff-invite
// (default JWT verification stays ON -- only a signed-in org member may call;
// we additionally enforce owner/admin server-side.)
//
// Expects POST body:
//   { "email": "chef@example.com", "roleName": "chef", "organizationId": "<uuid>" }
//
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are injected.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Service-role client for privileged reads and for sending the invite email.
const admin = createClient(supabaseUrl, serviceRoleKey);

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

  try {
    // 1. Identify the caller from their JWT.
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return bad('Authentication required', 401);
    const callerAuthId = userData.user.id;

    // 2. Validate input.
    let body: { email?: unknown; roleName?: unknown; organizationId?: unknown };
    try {
      body = await req.json();
    } catch {
      return bad('Invalid JSON body');
    }
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const roleName = typeof body.roleName === 'string' ? body.roleName : '';
    if (!email) return bad('email is required');
    if (!isUuid(body.organizationId)) return bad('A valid organizationId is required');
    const organizationId = body.organizationId;
    if (!['owner', 'admin', 'manager', 'chef'].includes(roleName)) {
      return bad('roleName must be owner, admin, manager, or chef');
    }

    // 3. Map caller -> app user id.
    const { data: appUser, error: appUserErr } = await admin
      .from('users')
      .select('id')
      .eq('auth_id', callerAuthId)
      .is('deleted_at', null)
      .maybeSingle();
    if (appUserErr || !appUser) return bad('Caller is not a provisioned user', 403);

    // 4. Confirm the caller is an owner/admin of this org (mirrors is_org_admin).
    const { data: membership, error: memErr } = await admin
      .from('organization_members')
      .select('id, roles!inner(name)')
      .eq('organization_id', organizationId)
      .eq('user_id', appUser.id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .in('roles.name', ['owner', 'admin'])
      .maybeSingle();
    if (memErr) {
      console.error('send-staff-invite membership lookup failed', memErr);
      return bad('Could not verify authorization', 500);
    }
    if (!membership) return bad('Only owners and admins can invite staff', 403);

    // 5. Confirm a matching pending invitation exists (recorded by the app).
    const { data: invite, error: invErr } = await admin
      .from('staff_invitations')
      .select('id, status, expires_at')
      .eq('organization_id', organizationId)
      .eq('email', email)
      .eq('role_name', roleName)
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .maybeSingle();
    if (invErr) {
      console.error('send-staff-invite invitation lookup failed', invErr);
      return bad('Could not load invitation', 500);
    }
    if (!invite) return bad('No pending invitation found for that email and role', 404);
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return bad('That invitation has expired', 410);
    }

    // 6. Send the built-in Supabase invitation email.
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { invited_role: roleName, organization_id: organizationId },
    });
    if (inviteErr) {
      console.error('inviteUserByEmail failed', inviteErr);
      // A user may already exist for this email; surface a clear message.
      return bad(inviteErr.message ?? 'Could not send invitation email', 502);
    }

    return new Response(JSON.stringify({ sent: true, email }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-staff-invite error', err);
    return bad('Internal error', 500);
  }
});
