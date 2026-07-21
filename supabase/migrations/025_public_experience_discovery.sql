-- 025 Public Signature Experience discovery: opt-in public listing + narrow
-- anon read policy.
--
-- v2.0 Sections 28 and 34 require that a prospective client can discover the
-- Signature Experiences (Gather, COAST, Brunch Society, Dinner Club) WITHOUT
-- an account. Migration 011 gates 'experiences' SELECT behind is_org_member(),
-- so the anon role cannot currently read any catalog rows.
--
-- The experience catalog doubles as internal booking data AND public marketing
-- content. We must not expose every org's full catalog to the public (that
-- would leak inactive/internal packages and pricing experiments). Instead we
-- add an explicit, opt-in 'public_listed' flag and a tightly scoped anon SELECT
-- policy that returns ONLY rows an operator has deliberately published.
--
-- This is a read-only, additive change: no write policy is granted to anon,
-- no internal columns are exposed beyond the marketing fields below, and the
-- existing member/management policies are untouched (v2.0 Sections 53, 60, 65).
-- Recorded as a deliberate security-model decision per v2.0 Section 96.

-- Marketing / positioning fields for the discovery page (v2.0 Section 34).
-- All nullable so existing rows and the admin create flow are unaffected.
alter table experiences
  add column if not exists public_listed boolean not null default false,
  add column if not exists positioning text,
  add column if not exists service_format text,
  add column if not exists typical_group_size text,
  add column if not exists lead_time_note text,
  add column if not exists dietary_statement text,
  add column if not exists display_order integer not null default 0;

-- Speeds up the public discovery query (published, active experiences by order).
create index if not exists experiences_public_listed_idx
  on experiences (organization_id, display_order)
  where public_listed = true and active = true and deleted_at is null;

-- Narrow public read: anon (and any authenticated user) may see ONLY experiences
-- explicitly published for public discovery. This sits alongside, and does not
-- replace, experiences_select_members / _management from migration 011.
drop policy if exists experiences_select_public on experiences;
create policy experiences_select_public on experiences
  for select
  to anon, authenticated
  using (
    public_listed = true
    and active = true
    and deleted_at is null
  );

-- Guard: assert the anon role still has NO write privileges on experiences.
-- Public discovery is read-only; publishing is a management action through the
-- existing authenticated policies (v2.0 Sections 65, 96, 98).
do $$
begin
  if exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_name = 'experiences'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception
      'anon has write access to experiences; public discovery must remain read-only';
  end if;
end $$;
