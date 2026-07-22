-- 032 Staff invitations: admin invite-before-signup provisioning (ADR 0002).
-- Adds a staff_invitations table so owners/admins can pre-assign a chef/manager
-- (or admin) role by email. The signup trigger (018) is rewritten to honor a
-- pending invitation on first login, otherwise it falls back to client.
-- Spec refs: v2.0 Sections 18 (roles), 55 (audit), 60/65 (RLS/authorization).

create table if not exists staff_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  email text not null,
  role_name text not null references roles(name),
  invited_by uuid references users(id),
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_user_id uuid references users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint staff_invitations_role_chk
    check (role_name in ('owner', 'admin', 'manager', 'chef')),
  constraint staff_invitations_status_chk
    check (status in ('pending', 'accepted', 'revoked', 'expired'))
);

-- One live pending invite per email per org.
create unique index if not exists staff_invitations_unique_pending
  on staff_invitations (organization_id, lower(email))
  where status = 'pending' and deleted_at is null;

create index if not exists staff_invitations_email_idx
  on staff_invitations (lower(email));

-- Normalize email to lowercase on write.
create or replace function staff_invitations_normalize_email()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(new.email);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists staff_invitations_normalize on staff_invitations;
create trigger staff_invitations_normalize
  before insert or update on staff_invitations
  for each row execute function staff_invitations_normalize_email();

-- RLS: only org owners/admins may read or manage invitations for their org.
alter table staff_invitations enable row level security;

drop policy if exists staff_invitations_select_admin on staff_invitations;
create policy staff_invitations_select_admin
  on staff_invitations
  for select
  using (is_org_admin(organization_id));

drop policy if exists staff_invitations_manage_admin on staff_invitations;
create policy staff_invitations_manage_admin
  on staff_invitations
  for all
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- Rewrite the signup bootstrap to honor a pending invitation first.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_user_id uuid;
  ncs_org_id uuid;
  invite record;
  target_role_id uuid;
  client_role_id uuid;
begin
  select id into ncs_org_id from organizations
    where slug = 'nashville-chef-service' limit 1;
  select id into client_role_id from roles where name = 'client' limit 1;

  insert into users (auth_id, email, status)
  values (new.id, new.email, 'active')
  returning id into new_user_id;

  if ncs_org_id is null then
    return new;
  end if;

  -- Look for a pending, unexpired invitation for this email in the NCS org.
  select * into invite
  from staff_invitations
  where organization_id = ncs_org_id
    and lower(email) = lower(new.email)
    and status = 'pending'
    and deleted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if invite.id is not null then
    -- Staff path: provision the invited role.
    select id into target_role_id from roles where name = invite.role_name limit 1;

    if target_role_id is not null then
      insert into organization_members (organization_id, user_id, role_id, status)
      values (ncs_org_id, new_user_id, target_role_id, 'active')
      on conflict (organization_id, user_id, role_id) do nothing;

      -- Chefs need a chef_profiles row for assignment flows.
      if invite.role_name = 'chef' then
        insert into chef_profiles (organization_id, user_id)
        values (ncs_org_id, new_user_id)
        on conflict do nothing;
      end if;

      update staff_invitations
        set status = 'accepted',
            accepted_user_id = new_user_id,
            accepted_at = now(),
            updated_at = now()
        where id = invite.id;

      return new;
    end if;
  end if;

  -- Default client path (unchanged behavior).
  if client_role_id is not null then
    insert into organization_members (organization_id, user_id, role_id, status)
    values (ncs_org_id, new_user_id, client_role_id, 'active')
    on conflict (organization_id, user_id, role_id) do nothing;

    insert into client_profiles (organization_id, user_id)
    values (ncs_org_id, new_user_id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
