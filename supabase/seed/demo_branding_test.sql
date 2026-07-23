-- ============================================================================
-- OPTIONAL: prove per-tenant runtime theming works.
-- Sets a custom brand palette on Nashville Chef Service. Reload the app after
-- running to see the new colors. Safe + reversible (see the RESET block below).
-- Run in the Supabase SQL editor (service role).
-- ============================================================================

update organizations
set
  brand_name       = 'Nashville Chef Service',
  brand_tagline    = 'Dinner is handled.',
  color_background = '#F5EFE5',  -- keep cream
  color_text       = '#22273F',  -- deep navy text (was espresso)
  color_primary    = '#CD7E56',  -- terracotta primary (was denim)
  color_accent     = '#46627C',  -- denim accent
  color_surface    = '#FFFFFF',
  color_border     = '#E4DACB',
  color_text_muted = '#6B5D50'
where slug = 'nashville-chef-service';

-- To RESET back to the default Brand palette, run this instead:
-- update organizations set brand_name=null, brand_tagline=null,
--   color_background=null, color_text=null, color_primary=null,
--   color_accent=null, color_surface=null, color_border=null,
--   color_text_muted=null
-- where slug = 'nashville-chef-service';
