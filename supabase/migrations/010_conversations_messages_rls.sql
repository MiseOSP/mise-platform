-- 010 conversations & messages RLS
-- A simple event-scoped chat. Participants are: management (owner/admin/manager) for their
-- org, the client who owns the event, and any chef who has ACCEPTED an assignment on that
-- event (pending/declined chefs cannot see or send messages). A conversation with no
-- event_id is treated as an org-internal thread, visible only to management.

create or replace function can_access_event(target_event uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from events e
    where e.id = target_event
      and (
        is_org_management(e.organization_id)
        or e.client_id in (select id from client_profiles where user_id = app_user_id())
        or exists (
          select 1 from event_assignments ea
          join chef_profiles cp on cp.id = ea.chef_id
          where ea.event_id = e.id
            and cp.user_id = app_user_id()
            and ea.status = 'accepted'
            and ea.deleted_at is null
        )
      )
  );
$$;

grant execute on function can_access_event(uuid) to authenticated;

create policy conversations_select_participant on conversations
  for select
  to authenticated
  using (
    case
      when event_id is not null then can_access_event(event_id)
      else is_org_management(organization_id)
    end
  );

create policy conversations_insert_participant on conversations
  for insert
  to authenticated
  with check (
    case
      when event_id is not null then can_access_event(event_id)
      else is_org_management(organization_id)
    end
  );

create policy messages_select_participant on messages
  for select
  to authenticated
  using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (
          case
            when c.event_id is not null then can_access_event(c.event_id)
            else is_org_management(c.organization_id)
          end
        )
    )
  );

create policy messages_insert_participant on messages
  for insert
  to authenticated
  with check (
    sender_id = app_user_id()
    and exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (
          case
            when c.event_id is not null then can_access_event(c.event_id)
            else is_org_management(c.organization_id)
          end
        )
    )
  );
