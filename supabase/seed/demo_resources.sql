-- ============================================================================
-- Seed demo Operations Library resources for Nashville Chef Service.
-- Idempotent: safe to re-run. Resolves the org by slug (never hardcodes id).
-- Visibility: RLS (resources_select_staff) restricts these to STAFF (chef +
--   admin/management) only. Clients never see them. Management can add/delete
--   in-app via the Library screen.
-- These are TEXT-based entries (file_url stays null) so they render immediately
--   without needing files uploaded to Storage. Attach files later in-app.
-- Categories align with the Library UI's free-text "category" tag.
-- Run in the Supabase SQL editor (service role).
-- ============================================================================
do $$
declare
  v_org uuid;
begin
  select id into v_org from organizations where slug = 'nashville-chef-service';
  if v_org is null then
    raise exception 'NCS org not found (slug=nashville-chef-service)';
  end if;

  -- Idempotency: clear any prior demo rows for this org before re-inserting,
  -- matched by the exact demo titles below (leaves real content untouched).
  delete from resources
   where organization_id = v_org
     and title in (
       'Plating Guide: COAST Amuse-Bouche',
       'Plating Guide: Gather Family-Style Entree',
       'Plating Guide: Dinner Club Tasting Course',
       'Recipe: House Herb Compound Butter',
       'Recipe: Signature Vinaigrette Base',
       'SOP: Event Day Timeline & Mise en Place',
       'SOP: Client Allergy & Dietary Protocol',
       'SOP: Kitchen Breakdown & Pack-Out Checklist'
     );

  insert into resources (organization_id, category, title, description, content, file_url)
  values
    (v_org, 'Plating Guide',
     'Plating Guide: COAST Amuse-Bouche',
     'Standard plating for the COAST opening bite.',
     'Center the amuse on a chilled small plate. Keep the composition low and tight to the center. Finish with microgreens and a light citrus oil around (not on) the bite. Wipe rims before pass.',
     null),
    (v_org, 'Plating Guide',
     'Plating Guide: Gather Family-Style Entree',
     'Family-style presentation for Gather entrees.',
     'Plate onto warmed shared platters. Protein fanned or stacked slightly off-center, sauce underneath or on the side (never pooled over). Garnish generously since this is the table centerpiece. Provide serving utensils per platter.',
     null),
    (v_org, 'Plating Guide',
     'Plating Guide: Dinner Club Tasting Course',
     'Fine-dining plating for the five-course tasting.',
     'Individual plated courses. Use negative space intentionally; three points of composition. Sauces applied with spoon or squeeze bottle for control. Temperature and rim cleanliness checked on every plate before it leaves the kitchen.',
     null),
    (v_org, 'Recipe',
     'Recipe: House Herb Compound Butter',
     'Base compound butter used across multiple menus.',
     'Soften unsalted butter to room temp. Fold in finely minced parsley, chives, thyme, roasted garlic, lemon zest, flaky salt, and cracked pepper to taste. Roll in parchment into a log, chill until firm, slice to order. Scale to event guest count.',
     null),
    (v_org, 'Recipe',
     'Recipe: Signature Vinaigrette Base',
     'All-purpose vinaigrette base for salads.',
     'Whisk Dijon with sherry vinegar and a touch of honey, then slowly stream in olive oil to emulsify. Season with salt and pepper. Adjust acidity per menu. Holds refrigerated; re-emulsify before service.',
     null),
    (v_org, 'SOP',
     'SOP: Event Day Timeline & Mise en Place',
     'Standard event-day flow from load-in to service.',
     'Confirm final headcount and dietary notes the morning of. Load-in and kitchen assessment on arrival. Complete all mise en place before guests arrive. Stage courses to the agreed timeline. Communicate any delays to the host early.',
     null),
    (v_org, 'SOP',
     'SOP: Client Allergy & Dietary Protocol',
     'How allergies and restrictions are handled on site.',
     'Review flagged allergies/restrictions before prep. Keep allergen-free items physically separated with dedicated tools and surfaces. Confirm with the guest directly when in doubt. Never guess on a stated allergy; escalate to the lead chef.',
     null),
    (v_org, 'SOP',
     'SOP: Kitchen Breakdown & Pack-Out Checklist',
     'End-of-event cleanup and pack-out steps.',
     'Break down stations, wipe and sanitize all used surfaces, and restore the host kitchen to its original state. Pack equipment by kit. Remove all trash. Do a final walkthrough with the host before departure and confirm satisfaction.',
     null);

  raise notice 'Seeded % demo resources for org %', 8, v_org;
end $$;
