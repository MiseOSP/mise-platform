-- 014: audit_logs was created in 001_init.sql with no RLS and no write path.
-- This closes both gaps: management-only read access, plus trigger functions
-- that populate the audit trail for key financial/event actions.

alter table audit_logs enable row level security;

create policy audit_logs_select_management on audit_logs
  for select
  to authenticated
  using (is_org_management(organization_id));

-- events: organization_id is a direct column.
create or replace function log_events_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    new.organization_id,
    app_user_id(),
    lower(tg_op),
    'events',
    new.id,
    jsonb_build_object('status', new.status, 'event_date', new.event_date)
  );
  return new;
end;
$$;

drop trigger if exists events_audit_trigger on events;
create trigger events_audit_trigger
  after insert or update on events
  for each row execute function log_events_audit();

-- payments: organization_id is a direct column.
create or replace function log_payments_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    new.organization_id,
    app_user_id(),
    lower(tg_op),
    'payments',
    new.id,
    jsonb_build_object('status', new.status, 'amount', new.amount, 'payment_type', new.payment_type)
  );
  return new;
end;
$$;

drop trigger if exists payments_audit_trigger on payments;
create trigger payments_audit_trigger
  after insert or update on payments
  for each row execute function log_payments_audit();

-- payouts: no organization_id column -- resolved via the parent event.
create or replace function log_payouts_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org uuid;
begin
  select organization_id into target_org from events where id = new.event_id;
  insert into audit_logs (organization_id, user_id, action, table_name, record_id, metadata)
  values (
    target_org,
    app_user_id(),
    lower(tg_op),
    'payouts',
    new.id,
    jsonb_build_object('status', new.status, 'amount', new.amount)
  );
  return new;
end;
$$;

drop trigger if exists payouts_audit_trigger on payouts;
create trigger payouts_audit_trigger
  after insert or update on payouts
  for each row execute function log_payouts_audit();
