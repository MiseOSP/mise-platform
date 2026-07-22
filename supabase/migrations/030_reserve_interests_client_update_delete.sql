-- 030 reserve interests: allow a client to edit/delete their own interest
--
-- Migration 029 added reserve_interests_insert_client (INSERT-only). Product
-- decision: a client may also edit (e.g. update notes / cadence / preferred
-- day) and delete their own reserve interest. This adds UPDATE and DELETE
-- policies scoped to rows tied to a relationship the client owns
-- (relationships.primary_user_id = app_user_id()).
--
-- The UPDATE policy checks ownership on both the existing row (using) and the
-- proposed row (with check), pinning organization_id to the relationship, so a
-- client cannot move their interest to another relationship or organization.
--
-- Staff (admin/chef) writes remain governed by reserve_interests_manage_staff
-- (022). These client policies only ever widen access to the client's OWN rows.

create policy reserve_interests_update_client on reserve_interests
  for update
  to authenticated
  using (
    relationship_id is not null
    and exists (
      select 1 from relationships r
      where r.id = relationship_id
        and r.deleted_at is null
        and r.primary_user_id = app_user_id()
        and r.organization_id = reserve_interests.organization_id
    )
  )
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

create policy reserve_interests_delete_client on reserve_interests
  for delete
  to authenticated
  using (
    relationship_id is not null
    and exists (
      select 1 from relationships r
      where r.id = relationship_id
        and r.deleted_at is null
        and r.primary_user_id = app_user_id()
        and r.organization_id = reserve_interests.organization_id
    )
  );
