-- 020 fix infinite recursion introduced by migration 019
--
-- 019's client_profiles policy embedded an `exists (... join events ...)`
-- subquery directly in the policy. events has its own RLS policy
-- (events_select_client_own) that subqueries client_profiles, and Postgres
-- applies RLS to subqueries inside policies too -- so evaluating the
-- client_profiles policy required evaluating the events policy, which
-- required evaluating the client_profiles policy again: infinite
-- recursion. Fix: move the assignment check into a SECURITY DEFINER helper
-- (same pattern as is_org_member/is_org_staff/etc. -- see migration 003's
-- header comment), which bypasses RLS internally and breaks the cycle.

create or replace function is_chef_assigned_to_client(target_client_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from event_assignments ea
    join events e on e.id = ea.event_id
    where e.client_id = target_client_profile_id
    and ea.deleted_at is null
    and ea.chef_id in (select id from chef_profiles where user_id = app_user_id())
  )
$$;

grant execute on function is_chef_assigned_to_client(uuid) to authenticated;

drop policy if exists client_profiles_select_self_mgmt_or_assigned_chef on client_profiles;
create policy client_profiles_select_self_mgmt_or_assigned_chef on client_profiles
for select
to authenticated
using (
  user_id = app_user_id()
  or is_org_management(organization_id)
  or is_chef_assigned_to_client(id)
);
