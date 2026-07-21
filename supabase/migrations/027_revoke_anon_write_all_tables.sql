-- 027 Security hardening: remove all public 'anon' write access to the schema
--
-- A prior blanket grant left the public 'anon' role holding INSERT/UPDATE/
-- DELETE/TRUNCATE on ~all tables in the public schema (including users, roles,
-- role_permissions, stripe_events, and every CRM/catalog/financial table).
-- This violates the trusted-write boundary: the public role must never write
-- directly to the database. All public writes flow through trusted Edge
-- Functions running with the service-role key (which bypasses these grants).
--
-- This migration is idempotent and defense-in-depth: migrations 024 and 025
-- already revoke the specific relationship/experiences tables their guards
-- assert on; this closes the exposure across every remaining table and stops
-- future tables from inheriting anon writes.
--
-- Deliberate, reviewed privilege change (v2.0 Sections 60, 65, 96, 98).

revoke insert, update, delete, truncate on all tables in schema public from anon;

alter default privileges in schema public
  revoke insert, update, delete, truncate on tables from anon;

-- Belt-and-suspenders assertion: no anon write grant may remain.
do $$
begin
  if exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ) then
    raise exception 'anon still holds write privileges in public schema after revoke';
  end if;
end $$;
