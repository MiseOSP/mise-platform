-- ============================================================================
-- DEMO / PREVIEW SEED for Nashville Chef Service (tenant #1)
-- ----------------------------------------------------------------------------
-- Purpose: give the founder a realistic dataset + all role grants so the app
-- can be experienced through every lens (client / chef / admin) in the preview.
--
-- SAFETY NOTES:
--   * Run this in the Supabase SQL editor (service role) for the DEV project.
--   * It does NOT create any auth accounts. It only:
--       - grants extra org roles to your EXISTING user, and
--       - inserts demo business rows (client profile + one event).
--   * It is idempotent: re-running it will not create duplicates.
--   * To target a specific user, edit v_email below.
-- ============================================================================

do $$
declare
  v_email      text := 'jpwhite1995@gmail.com';  -- <-- your existing login
  v_org_id     uuid;
  v_user_id    uuid;
  v_client_role   uuid;
  v_chef_role     uuid;
  v_admin_role    uuid;
  v_client_prof   uuid;
  v_experience_id uuid;
begin
  -- Resolve the NCS org and your user (fail loudly if missing)
  select id into v_org_id  from organizations where slug = 'nashville-chef-service' limit 1;
  if v_org_id is null then
    raise exception 'NCS org (slug=nashville-chef-service) not found';
  end if;

  select id into v_user_id from users where email = v_email limit 1;
  if v_user_id is null then
    raise exception 'User % not found in users table', v_email;
  end if;

  -- Look up role ids
  select id into v_client_role from roles where name = 'client' limit 1;
  select id into v_chef_role   from roles where name = 'chef'   limit 1;
  select id into v_admin_role  from roles where name = 'admin'  limit 1;

  -- Grant chef + admin (client is assumed already granted). Idempotent.
  insert into organization_members (organization_id, user_id, role_id, status)
  values (v_org_id, v_user_id, v_chef_role, 'active')
  on conflict (organization_id, user_id, role_id) do nothing;

  insert into organization_members (organization_id, user_id, role_id, status)
  values (v_org_id, v_user_id, v_admin_role, 'active')
  on conflict (organization_id, user_id, role_id) do nothing;

  -- Also make sure the client grant exists so the client lens works
  insert into organization_members (organization_id, user_id, role_id, status)
  values (v_org_id, v_user_id, v_client_role, 'active')
  on conflict (organization_id, user_id, role_id) do nothing;

  -- Demo client profile for your user (idempotent on org+user)
  select id into v_client_prof
    from client_profiles where organization_id = v_org_id and user_id = v_user_id limit 1;
  if v_client_prof is null then
    insert into client_profiles
      (organization_id, user_id, address, city, state, zip,
       dietary_preferences, allergies, notes, lifetime_value)
    values
      (v_org_id, v_user_id, '123 Belle Meade Blvd', 'Nashville', 'TN', '37205',
       'Prefers seasonal, local produce', 'Shellfish',
       'Demo client profile created by preview seed.', 0)
    returning id into v_client_prof;
  end if;

  -- Pick any experience for this org if one exists (nullable otherwise)
  select id into v_experience_id
    from experiences where organization_id = v_org_id limit 1;

  -- Demo event (only create if none exists yet for this org)
  if not exists (select 1 from events where organization_id = v_org_id and occasion = 'Anniversary Dinner (demo)') then
    insert into events
      (organization_id, client_id, experience_id, assigned_chef_id, status,
       event_date, start_time, guest_count, occasion, address, city, state,
       client_notes, service_fee)
    values
      (v_org_id, v_client_prof, v_experience_id, v_user_id, 'confirmed',
       (now() + interval '21 days')::date, '18:30', 8, 'Anniversary Dinner (demo)',
       '123 Belle Meade Blvd', 'Nashville', 'TN',
       'Please plan a 4-course tasting menu. One guest is allergic to shellfish.',
       650);
  end if;

  raise notice 'Seed complete. org=% user=% client_profile=%', v_org_id, v_user_id, v_client_prof;
end $$;
