# ADR 0002: Staff Provisioning via Admin Invite-Before-Signup

- Status: Accepted
- Date: 2026-07-21
- Supersedes: partial behavior of migration 018 (all signups become client)
- Governing spec: Mise Product & Engineering Specification v2.0 (Sections 18, 55, 63, 65, 105)

## Context

The v2.0 spec (Section 18) defines four platform roles (owner, admin, chef,
client) granted through organization memberships. Migration 018 auto-provisions
EVERY new Supabase Auth signup as a client in the Nashville Chef Service org.
This is correct for the public client self-serve path (Section 18: a person can
inquire/book without an account, client role optional at intake) but leaves no
path to create chef or manager accounts.

assignments.ts assignChefByEmail requires the chef to already have a
chef_profiles row; there is no flow to turn a fresh signup into staff. Section
105 lists "initial supported authentication methods" and the account-creation
point as OPEN DECISIONS that must be resolved configurably by the product owner,
not silently by an engineer (Section 96). Section 65 is explicit: UI visibility
is not authorization; the role must be real and enforced at the database.

Two candidate models were considered:

1. Invite-before-signup: an admin records the invitee email + intended role
   before they sign up; the signup trigger provisions the invited role on first
   login. Deny-by-default: a stranger can never self-assign staff access.
2. Promote-after-signup: everyone signs up as client, an admin later flips the
   role. Simpler, but there is a window where a chef is a client, and it is more
   error-prone.

## Decisions

1. Adopt invite-before-signup as the PRIMARY staff-provisioning model. This is
   the product owner's decision, recorded here per Section 96. Promote-after-
   signup may be added later as a manual admin fallback but is not the default.

2. Add a staff_invitations table (organization-scoped): email (lowercased),
   role name, invited_by, status (pending/accepted/revoked/expired), expires_at,
   timestamps. RLS restricts all access to org admins/owners via is_org_admin,
   consistent with Sections 60 and 65.

3. Modify handle_new_auth_user() (migration 018): after creating the users row,
   look up a pending, unexpired invitation matching the new email. If found,
   provision the invited role (and a chef_profiles row for chef) and mark the
   invitation accepted. If none, fall back to the existing client behavior. The
   trigger remains the single source of signup provisioning; no client can
   influence which branch runs because the invitation is admin-created.

4. Only owner/admin may create or manage invitations (is_org_admin). Manager is
   invitable AS a role but managers do not themselves manage invitations in this
   iteration.

## Consequences

- New migration 032 adds staff_invitations + RLS and rewrites the signup trigger
  non-destructively. Existing client signups are unaffected when no invitation
  exists.
- This is a Phase Four (Admin Operations, Section 90: chef assignment / role
  management) capability pulled forward because it unblocks chef assignment and
  the Reserve staff queue. The milestone jump is intentional and owner-approved.
- Invitation records are audit-relevant (Section 55: org membership + role
  changes). A follow-up may write audit_logs entries on accept.
- Email is matched case-insensitively; invitations carry an expiry so stale
  invites cannot silently grant access.
- No secrets involved. The user applies migration 032 via supabase db push.
