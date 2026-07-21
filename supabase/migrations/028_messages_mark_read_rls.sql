-- 028 messages: allow participants to mark received messages as read
--
-- Migrations 010 gave participants SELECT and INSERT on messages, but no
-- UPDATE policy. The in-app unread badge needs to stamp read_at on messages
-- the current user received (i.e. did not send). This policy permits exactly
-- that: a participant of the conversation may UPDATE a message they did NOT
-- send. Column-level restriction (only read_at may change) is enforced in the
-- app layer; this policy scopes *which rows* are updatable.
--
-- Participation reuses the same access check as messages_select_participant:
-- event-scoped conversations use can_access_event(); org-internal threads
-- (null event_id) are limited to org management.

create policy messages_update_mark_read on messages
  for update
  to authenticated
  using (
    sender_id <> app_user_id()
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
  )
  with check (
    sender_id <> app_user_id()
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
