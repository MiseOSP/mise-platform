-- 018 Signup bootstrap: seed the single managed tenant (Nashville Chef
-- Service) and auto-provision app-level users/organization_members/
-- client_profiles rows when someone signs up via Supabase Auth.
-- Without this, a new auth.users row had no corresponding app profile,
-- role, or organization -- leaving new signups completely non-functional.

insert into organizations (name, slug, subscription_plan, status)
select 'Nashville Chef Service', 'nashville-chef-service', 'pilot', 'active'
where not exists (
  select 1 from organizations where slug = 'nashville-chef-service'
);

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_user_id uuid;
  ncs_org_id uuid;
  client_role_id uuid;
begin
  select id into ncs_org_id from organizations where slug = 'nashville-chef-service' limit 1;
  select id into client_role_id from roles where name = 'client' limit 1;

  insert into users (auth_id, email, status)
  values (new.id, new.email, 'active')
  returning id into new_user_id;

  if ncs_org_id is not null and client_role_id is not null then
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
