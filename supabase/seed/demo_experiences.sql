-- ============================================================================
-- Seed the four NCS Signature Experiences + menu categories + menu items.
-- Idempotent: safe to re-run. Resolves the org by slug (never hardcodes id).
-- Data source: NCS menu docs + nashvillechefservice.com (prices current).
-- Menu item DESCRIPTIONS are intentionally brief; enrich later in-app.
-- starting_price is the display "from" price (whole dollars), NOT the ledger.
-- Run in the Supabase SQL editor (service role).
-- ============================================================================
do $$
declare
  v_org uuid;
  v_exp uuid;
  v_cat uuid;
begin
  select id into v_org from organizations where slug = 'nashville-chef-service';
  if v_org is null then
    raise exception 'NCS org not found (slug=nashville-chef-service)';
  end if;

  -- Helper pattern: upsert experience by (org, name), then reset its menu.
  -- ---- GATHER --------------------------------------------------------------
  select id into v_exp from experiences where organization_id = v_org and name = 'Gather';
  if v_exp is null then
    insert into experiences (organization_id, name, description, starting_price, active)
    values (v_org, 'Gather',
      'A relaxed, shareable multi-course dinner. Guests choose 2 appetizers, 1 salad, 1 entree, 2 vegetables, and 1 dessert. Includes complimentary in-house bread service.',
      135, true)
    returning id into v_exp;
  else
    update experiences set description =
      'A relaxed, shareable multi-course dinner. Guests choose 2 appetizers, 1 salad, 1 entree, 2 vegetables, and 1 dessert. Includes complimentary in-house bread service.',
      starting_price = 135, active = true, deleted_at = null
    where id = v_exp;
  end if;
  delete from menu_items where category_id in (select id from menu_categories where experience_id = v_exp);
  delete from menu_categories where experience_id = v_exp;

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Appetizers (Choose 2)', 1) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Whipped Feta', 'Urfa biber, lemon zest, scallions, extra-virgin olive oil, charred carrots, warm pita'),
    (v_cat, 'Milk-Bread Meatballs', 'Sunday sauce, Parmesan, fresh basil'),
    (v_cat, 'Maple-Glazed Smoked Sausage Board', 'Charred apples, cider mustard, pickled red onions, fresh herbs'),
    (v_cat, 'Charred Peach & Burrata Panzanella', 'Prosciutto cracklings'),
    (v_cat, 'Cannellini Bean Dip', 'Seasonal accompaniments');

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Salads (Choose 1)', 2) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Little Gem & Green Apple Salad', 'Little Gem lettuce, green apple, aged Gouda, toasted pecans, cider vinaigrette'),
    (v_cat, 'Arugula & Pear Salad', 'Baby arugula, sliced raw pear, shaved Parmesan, toasted almonds, lemon-Dijon vinaigrette');

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Entrees (Choose 1)', 3) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Red Wine-Braised Short Rib', 'Horseradish whipped potatoes, roasted-garlic red-wine jus'),
    (v_cat, 'Herb-Roasted Chicken', 'Carolina Gold rice pilaf, lemon-thyme pan jus'),
    (v_cat, 'Chimichurri Flank Steak', 'Crispy roasted potatoes, charred-scallion chimichurri'),
    (v_cat, 'Roasted Local Catch', 'Seasonal preparation'),
    (v_cat, 'Eggplant Involtini', 'Baked Parmesan polenta, Sunday sauce, whipped ricotta, fresh basil'),
    (v_cat, 'Wild Mushroom Baked Rigatoni', 'Roasted-garlic cream sauce, fontina, Parmesan, herb breadcrumbs');

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Vegetables (Choose 2)', 4) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Lemon-Garlic Roasted Broccoli', 'Roasted garlic, lemon zest, chili flakes, extra-virgin olive oil'),
    (v_cat, 'Brown-Butter Green Beans', 'Toasted almonds, shallots, fresh lemon'),
    (v_cat, 'Cider-Glazed Brussels Sprouts', 'Caramelized onions, toasted pecans, apple-cider reduction'),
    (v_cat, 'Braised Collard Greens', 'Smoked tomato, garlic, cider vinegar'),
    (v_cat, 'Honey-Thyme Roasted Carrots', 'Fresh herbs, cracked black pepper'),
    (v_cat, 'Roasted Seasonal Vegetables', 'Herb oil, aged balsamic, finishing salt');

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Desserts (Choose 1)', 5) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Chocolate Cardamom Cookie', ''),
    (v_cat, 'Sourdough Chocolate Chip Cookies', ''),
    (v_cat, 'White & Dark Chocolate Bread Pudding', ''),
    (v_cat, 'Seasonal Fruit Cobbler', 'Brown-sugar buttermilk biscuit topping, vanilla whip'),
    (v_cat, 'Blackberry-Lemon Cobbler', 'Cornmeal biscuit topping, local honey, whipped mascarpone'),
    (v_cat, 'Classic Tiramisu', ''),
    (v_cat, 'Lemon Olive Oil Cake', 'Seasonal berry compote, whipped mascarpone');

  raise notice 'Gather seeded: %', v_exp;
end $$;

do $$
declare
  v_org uuid;
  v_exp uuid;
  v_cat uuid;
begin
  select id into v_org from organizations where slug = 'nashville-chef-service';
  if v_org is null then raise exception 'NCS org not found'; end if;

  -- ---- COAST ---------------------------------------------------------------
  select id into v_exp from experiences where organization_id = v_org and name = 'COAST';
  if v_exp is null then
    insert into experiences (organization_id, name, description, starting_price, active)
    values (v_org, 'COAST',
      'A coastal, seafood-forward dinner. Includes a Chef''s Choice amuse-bouche, 2 shareable appetizers, a plated entree with shareable sides, and a plated dessert.',
      165, true) returning id into v_exp;
  else
    update experiences set description =
      'A coastal, seafood-forward dinner. Includes a Chef''s Choice amuse-bouche, 2 shareable appetizers, a plated entree with shareable sides, and a plated dessert.',
      starting_price = 165, active = true, deleted_at = null where id = v_exp;
  end if;
  delete from menu_items where category_id in (select id from menu_categories where experience_id = v_exp);
  delete from menu_categories where experience_id = v_exp;

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Amuse-Bouche (Chef''s Choice)', 1) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Seasonal Opening Bite', 'A complimentary chef''s amuse-bouche inspired by the evening''s menu');

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Shared Appetizers (Choose 2)', 2) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Ceviche Verde', 'Local catch, tomatillo, lime, cucumber, cilantro, avocado, Fritos-style corn chips');

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Entrees (Choose 1)', 3) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Pan-Roasted Seasonal White Fish', 'White-bean puree, tomato-olive nage, charred fennel, basil oil'),
    (v_cat, 'Seared Sea Scallops', 'Sweet-corn risotto, tomato confit, citrus beurre blanc, basil oil'),
    (v_cat, 'Blackened Redfish', 'Crispy potato cake, smoked tomato veloute, pickled okra and celery salad'),
    (v_cat, 'Olive-Oil-Poached Salmon', 'Lemon-herb fregola, dill beurre blanc, cucumber ribbons, trout roe'),
    (v_cat, 'Beef Tenderloin with Blue Crab', 'Creamed hominy, bordelaise, buttered jumbo-lump blue crab, charred scallions'),
    (v_cat, 'Charred Cauliflower & Crispy Chickpea Cake', 'Roasted-tomato and olive nage, lemon yogurt, crispy chickpeas, fresh herbs');

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Shared Sides', 4) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Roasted Delicata Squash', 'Brown butter, toasted pepitas, lime, Urfa biber');

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Plated Dessert (Choose 1)', 5) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Meyer Lemon Posset', 'Blueberry compote, whipped mascarpone, benne shortbread'),
    (v_cat, 'Dark Chocolate Budino', 'Orange caramel, extra-virgin olive oil, toasted sesame, sea salt'),
    (v_cat, 'Rum-Roasted Pineapple & Cornmeal Cake', 'Coconut cream, lime syrup, toasted pecans'),
    (v_cat, 'Basque Cheesecake', 'Roasted strawberry sauce, toasted almonds'),
    (v_cat, 'Citrus-Poached Pear', 'Mascarpone cream, honey syrup, pistachios, candied citrus');

  -- ---- BRUNCH SOCIETY ------------------------------------------------------
  select id into v_exp from experiences where organization_id = v_org and name = 'Brunch Society';
  if v_exp is null then
    insert into experiences (organization_id, name, description, starting_price, active)
    values (v_org, 'Brunch Society',
      'A chef-driven brunch served family-style. Includes complimentary breakfast bread, two shared starters, one savory centerpiece, one sweet centerpiece, two sides, and kitchen cleanup. 10-guest or $1,150 service minimum; groceries additional with an estimate before booking.',
      115, true) returning id into v_exp;
  else
    update experiences set description =
      'A chef-driven brunch served family-style. Includes complimentary breakfast bread, two shared starters, one savory centerpiece, one sweet centerpiece, two sides, and kitchen cleanup. 10-guest or $1,150 service minimum; groceries additional with an estimate before booking.',
      starting_price = 115, active = true, deleted_at = null where id = v_exp;
  end if;
  delete from menu_items where category_id in (select id from menu_categories where experience_id = v_exp);
  delete from menu_categories where experience_id = v_exp;

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Shared Starters (Choose 2)', 1) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Deviled Egg Board', '2 eggs per person: Classic (paprika, chives), Pimento Cheese (pickled jalapeno), or Nashville Hot Spice (pickle garnish)'),
    (v_cat, 'Seasonal Fruit Platter', 'Fresh seasonal fruit, citrus and mint, honey-lime yogurt or whipped ricotta'),
    (v_cat, 'Breakfast Charcuterie', 'Country ham, prosciutto, cured meats, soft and aged cheeses, seasonal preserves, fruit, toasted nuts, pickles, mustard, crackers and crostini');

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Savory Centerpiece (Choose 1)', 2) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Chef''s Savory Centerpiece', 'Seasonal chef-selected savory main');

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Sweet Centerpiece (Choose 1)', 3) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Chef''s Sweet Centerpiece', 'Seasonal chef-selected sweet main');

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Sides (Choose 2)', 4) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'Chef-Selected Brunch Side', 'Seasonal side');

  -- ---- DINNER CLUB ---------------------------------------------------------
  select id into v_exp from experiences where organization_id = v_org and name = 'Dinner Club';
  if v_exp is null then
    insert into experiences (organization_id, name, description, starting_price, active)
    values (v_org, 'Dinner Club',
      'Our most chef-driven private dining experience: an original five-course plated tasting menu created around the season, your preferences, and the chef''s point of view. Rather than choosing from a fixed menu, you help establish the direction and the chef designs the menu for your event.',
      200, true) returning id into v_exp;
  else
    update experiences set description =
      'Our most chef-driven private dining experience: an original five-course plated tasting menu created around the season, your preferences, and the chef''s point of view. Rather than choosing from a fixed menu, you help establish the direction and the chef designs the menu for your event.',
      starting_price = 200, active = true, deleted_at = null where id = v_exp;
  end if;
  delete from menu_items where category_id in (select id from menu_categories where experience_id = v_exp);
  delete from menu_categories where experience_id = v_exp;

  insert into menu_categories (experience_id, name, display_order) values (v_exp, 'Five-Course Tasting (Chef-Designed)', 1) returning id into v_cat;
  insert into menu_items (category_id, name, description) values
    (v_cat, 'First Course - Amuse-Bouche', 'A small chef-selected bite that introduces the menu'),
    (v_cat, 'Second Course - Opening Course', 'A light, seasonally driven vegetable, salad, or chilled preparation'),
    (v_cat, 'Third Course - Intermediate Course', 'A composed seafood, pasta, grain, or vegetable course'),
    (v_cat, 'Fourth Course - Main Course', 'The most substantial course: meat, poultry, fish, or a composed vegetarian centerpiece'),
    (v_cat, 'Fifth Course - Dessert', 'A seasonal chef-designed dessert');

  raise notice 'COAST, Brunch Society, Dinner Club seeded.';
end $$;
