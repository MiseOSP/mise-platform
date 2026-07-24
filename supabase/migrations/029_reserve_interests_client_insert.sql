-- 029 reserve interests: allow a client to submit their own interest
--
-- Migration 022 enabled RLS on reserve_interests with three policies:
--   reserve_interests_select_staff  (org members can read their org rows)
--   reserve_interests_select_self   (a client can read their own rows)
--   reserve_interests_manage_staff  (FOR ALL, org ADMIN only for writes)
--
-- The client-facing Reserve screen (apps/mobile/src/app/reserve.tsx) calls
-- createReserveInterest(), which INSERTs a row. Under 022 only org admins
-- could insert, so a signed-in client hit RLS denial on submit. This adds a
-- narrow INSERT policy so a client can create an interest ONLY against a
-- relationship they own (relationships.primary_user_id = app_user_id()), and
-- only when the row organization_id matches that relationship org (so a client
-- cannot attach an interest to an arbitrary organization).
--
-- Staff (admin/chef) writes are unchanged: reserve_interests_manage_staff
-- still governs all staff inserts/updates/deletes (e.g. adding notes during a
-- consult). This policy is INSERT-only, so it grants clients no update/delete.

create policy reserve_interests_insert_client on reserve_interests
  for insert
  to authenticated
  with check (
    relationship_id is not null
    and exists (
      select 1 from relationships r
      where r.id = relationship_id
        and r.deleted_at is null
        and r.primary_user_id = app_user_id()
        and r.organization_id = reserve_interests.organization_id
    )
  );
