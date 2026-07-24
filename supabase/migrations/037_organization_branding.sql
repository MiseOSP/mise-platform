-- 037_organization_branding.sql
--
-- Per-tenant (white-label) branding for the Mise platform. Each organization
-- carries its own brand identity so the SAME app renders in that tenant''s
-- colors, name, and logo at runtime. Nashville Chef Service is tenant #1; future
-- subscribing operators are additional organizations with their own values.
--
-- Columns are additive and nullable/defaulted so existing rows keep working.
-- The app falls back to the built-in Brand tokens (constants/theme.ts) when a
-- value is null, so a new org with no branding still looks sane.
--
-- Semantic color roles mirror the app Brand token names:
--   background ("cream"), text ("espresso"), primary ("denim"/action+links),
--   secondary ("sage"), accent ("clay"/highlights+errors), surface (cards),
--   border (hairlines), text_muted (helper text).
-- Colors are stored as hex strings (e.g. ''#F5EFE5''). Validation of exact
-- format is intentionally lenient here; the app tolerates null + normalizes.

alter table organizations
  add column if not exists brand_name        text,
  add column if not exists brand_tagline      text,
  add column if not exists color_background   text,
  add column if not exists color_text         text,
  add column if not exists color_primary      text,
  add column if not exists color_secondary    text,
  add column if not exists color_accent       text,
  add column if not exists color_surface      text,
  add column if not exists color_border       text,
  add column if not exists color_text_muted   text,
  add column if not exists font_family        text;

-- Note: the pre-existing organizations.primary_color / logo_url columns remain.
-- color_primary supersedes primary_color for theming; logo_url is reused as-is.

comment on column organizations.brand_name is 'Tenant display name shown in-app (e.g. Nashville Chef Service). Falls back to organizations.name when null.';
comment on column organizations.color_primary is 'Primary action / link color (Brand.denim role). Hex string.';
