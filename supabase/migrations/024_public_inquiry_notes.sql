-- 024 Public inquiry: trusted-write boundary notes + supporting index
--
-- Public intake (v2.0 Sections 9, 18, 33) must let an anonymous visitor start
-- a Relationship WITHOUT an account. Migration 021 intentionally grants INSERT
-- on relationships / relationship_contacts only to org admins (RLS is
-- deny-by-default, v2.0 Sections 60, 65, 98). We do NOT add an 'anon' INSERT
-- policy here: allowing the public anon role to write directly into the CRM
-- would expose it to spam and abuse.
--
-- Instead, public inquiries flow through the 'public-inquiry' Edge Function,
-- which runs with the service-role key in a trusted server context and
-- performs validation before inserting. The service role bypasses RLS by
-- design, so no policy change is required for the function to work. This
-- migration exists to (a) record that decision alongside the schema and
-- (b) add an index that speeds up staff de-duplication of inbound inquiries
-- by contact email (v2.0 Section 58, relationship uniqueness / merging).

-- Case-insensitive lookup of inbound contacts by email during dedup review.
create index if not exists relationship_contacts_email_lower_idx
  on relationship_contacts (lower(email));

-- Remediation: some environments (and Supabase defaults) may have granted the
-- public 'anon' role table-level write privileges on the relationship tables.
-- Per the trusted-write boundary above (and v2.0 Sections 60, 65, 98), the anon
-- role must never hold direct write access to the CRM. Revoke it here so the
-- schema is self-healing and secure by default on every environment. This is a
-- deliberate, reviewed privilege change (v2.0 Section 96, change control).
revoke insert, update, delete, truncate on public.relationships from anon;
revoke insert, update, delete, truncate on public.relationship_contacts from anon;

-- Guard: confirm the anon role has NOT been granted write access to the
-- relationship tables. This is a documentation/assertion step that runs after the revoke above; it makes no further
-- change privileges. If a future migration loosens this, that change must be
-- deliberate and reviewed (v2.0 Section 96, change control).
do $$
begin
  if exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_name in ('relationships', 'relationship_contacts')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception
      'anon has write access to relationship tables; public intake must go through the public-inquiry Edge Function, not direct anon writes';
  end if;
end $$;
