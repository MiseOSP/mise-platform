-- 002 seed system roles
-- These are the baseline org-level roles referenced by organization_members.role_id.
-- Permissions/role_permissions grants can be layered on top of these in a later migration
-- once the exact permission matrix per Document 17 is finalized.
insert into roles (name, is_system_role) values
  ('owner', true),
  ('admin', true),
  ('manager', true),
  ('chef', true),
  ('client', true)
on conflict (name) do nothing;
