# Phase 5 - Chef Portal - Completion Report

Status: Feature-complete on branch `feat/v2-relationship-centric-refactor`.
Report format follows spec section 97 (code review checkpoint).
Canonical scope: spec section 91 (Phase Five deliverables) and section 102 (Chef Portal acceptance).

HEAD at report time: `4500e98`.

## 1. Summary

Phase 5 delivers the Chef Portal on top of the existing event, relationship, menu,
messaging, and assignment foundations from earlier phases. A chef can now sign in,
see only the events they are assigned to, accept or decline invitations, open a full
event detail view (menu + client-approved dietary/allergy notes), reach the operations
library and event messaging, mark required completion steps, and manage their weekly
availability. No client-facing or admin flows were changed.

## 2. Deliverables vs spec section 91

| Spec 91 deliverable            | Status | Where |
|--------------------------------|--------|-------|
| Chef login                     | Done (pre-existing) | auth + role routing |
| Chef profile                   | Done (pre-existing) | chef_profiles |
| Assignment invitation/response | Done   | my-assignments.tsx + respondToAssignment |
| Upcoming-event dashboard       | Done   | ChefPortalScreen + my-assignments.tsx |
| Event detail                   | Done   | event-detail.tsx |
| Menu and dietary visibility    | Done   | fetchEventMenuItems + migration 034 |
| Messaging                      | Done (MVP) | messages.tsx (event-scoped) |
| Resource access                | Done   | operations library link + library.tsx |
| Availability management        | Done   | availability.tsx + migration 036 |
| Completion reporting           | Done   | event_completion_steps + migration 035 |

Spec section 102 acceptance (chef can): sign in securely; view only authorized
assignments; accept/decline; review event and client-approved details; access menu and
resources; communicate within the event; manage availability; mark required completion
steps -- all satisfied.

## 3. Commits (this phase)

- `8b86226` dedicated my-assignments screen with accept/decline (S91)
- `72ff575` link chef portal to operations library (S91)
- `7b5913f` event-detail screen with menu view and dietary placeholder (S91/S68)
- `15ba24e` expose dietary/allergy to assigned chefs via chef_visible_events (migration 034, S68/S91)
- `71a53ed` completion reporting checklist on event detail (migration 035, S91/S102)
- `4500e98` weekly availability management (migration 036, S91/S102/S15)

## 4. Database migrations added

- `034_chef_visible_dietary.sql` - widens the `chef_visible_events` view to include
  `dietary_preferences` and `dietary_statement`; same WHERE (chef's own assignments) and
  same ~15h address-masking gate as before.
- `035_event_completion_steps.sql` - new `event_completion_steps` table (per-event
  checklist). Adds helper `is_chef_assigned_to_event(uuid)` and a guard trigger so a chef
  can only toggle completion, never edit the checklist.
- `036_chef_availability.sql` - new `chef_availability` table (recurring weekly slots,
  unique per chef+weekday). Chef has full CRUD on own rows; management may read.

All three are pushed but NOT yet applied to the live database. See section 8.

## 5. Business rules implemented

- Completion reporting is a management-defined checklist; the chef only marks steps done
  (spec 102 "mark required completion steps"). No new financial or status semantics.
- Availability is a recurring weekly pattern and is advisory only: admins still assign
  events manually in the MVP (spec 15). It does not gate assignment.
- Dietary exposure to chefs is limited to the fields needed for service and remains
  behind the assigned-chef + address-mask rules (spec 68: prominent but need-to-know).

No open business decisions were resolved by code. Society pricing and legal/cancellation
copy remain open (spec 105) and were not touched.

## 6. Security considerations

- Authorization is enforced by Row Level Security, not the UI (spec 51/60/65). New
  policies reuse the established patterns: self-scope via
  `chef_id in (select id from chef_profiles where user_id = app_user_id())`, management
  via `is_org_management(organization_id)`.
- The completion-steps guard trigger blocks a chef from renaming steps, moving them to
  another event, or soft-deleting them (defense in depth beyond the RLS policy).
- The dietary view change did not broaden the audience or drop the address-mask gate.
- No internal notes are exposed to chefs; no secrets added; no RLS disabled.

## 7. Tests and builds run

- TypeScript typecheck passed after every slice:
  `./apps/mobile/node_modules/.bin/tsc --noEmit -p apps/mobile/tsconfig.json` -> exit 0.
- SQL migrations are not typecheck-covered and have not been run against a live database.
- No automated unit/integration/RLS tests were added this phase (see risks).

## 8. Remaining risks and follow-ups

- MIGRATIONS NOT APPLIED: 033 (membership activation guard), 034, 035, and 036 are pushed
  but must be applied with `npx supabase db push` by the maintainer holding the Supabase
  token. Until then the completion checklist and availability screens show empty states
  and the dietary card shows "no notes recorded".
- No negative-case RLS tests yet (spec 60 wants RLS tested with denials, not just reads).
  Recommend adding these in Phase 6 hardening.
- Availability is weekly-only; per-date time off is not modeled yet (acceptable for MVP).
- Recurring Reserve billing is still deferred; pricing and legal copy remain open (spec 105).
