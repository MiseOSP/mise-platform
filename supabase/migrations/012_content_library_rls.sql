-- 012 content library RLS: resources, ingredients, recipes, recipe_ingredients

alter table resources enable row level security;
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;

-- resources
drop policy if exists resources_select_members on resources;
create policy resources_select_members on resources
  for select
  using (
    is_org_member(organization_id)
    and deleted_at is null
  );

drop policy if exists resources_select_management on resources;
create policy resources_select_management on resources
  for select
  using (is_org_management(organization_id));

drop policy if exists resources_insert_management on resources;
create policy resources_insert_management on resources
  for insert
  with check (is_org_management(organization_id));

drop policy if exists resources_update_management on resources;
create policy resources_update_management on resources
  for update
  using (is_org_management(organization_id))
  with check (is_org_management(organization_id));

-- ingredients
drop policy if exists ingredients_select_members on ingredients;
create policy ingredients_select_members on ingredients
  for select
  using (is_org_member(organization_id));

drop policy if exists ingredients_insert_management on ingredients;
create policy ingredients_insert_management on ingredients
  for insert
  with check (is_org_management(organization_id));

drop policy if exists ingredients_update_management on ingredients;
create policy ingredients_update_management on ingredients
  for update
  using (is_org_management(organization_id))
  with check (is_org_management(organization_id));

drop policy if exists ingredients_delete_management on ingredients;
create policy ingredients_delete_management on ingredients
  for delete
  using (is_org_management(organization_id));

-- recipes
drop policy if exists recipes_select_members on recipes;
create policy recipes_select_members on recipes
  for select
  using (is_org_member(organization_id));

drop policy if exists recipes_insert_management on recipes;
create policy recipes_insert_management on recipes
  for insert
  with check (is_org_management(organization_id));

drop policy if exists recipes_update_management on recipes;
create policy recipes_update_management on recipes
  for update
  using (is_org_management(organization_id))
  with check (is_org_management(organization_id));

drop policy if exists recipes_delete_management on recipes;
create policy recipes_delete_management on recipes
  for delete
  using (is_org_management(organization_id));

-- recipe_ingredients (join to recipes for org scoping)
drop policy if exists recipe_ingredients_select_members on recipe_ingredients;
create policy recipe_ingredients_select_members on recipe_ingredients
  for select
  using (
    exists (
      select 1 from recipes r
      where r.id = recipe_ingredients.recipe_id
        and is_org_member(r.organization_id)
    )
  );

drop policy if exists recipe_ingredients_insert_management on recipe_ingredients;
create policy recipe_ingredients_insert_management on recipe_ingredients
  for insert
  with check (
    exists (
      select 1 from recipes r
      where r.id = recipe_ingredients.recipe_id
        and is_org_management(r.organization_id)
    )
  );

drop policy if exists recipe_ingredients_update_management on recipe_ingredients;
create policy recipe_ingredients_update_management on recipe_ingredients
  for update
  using (
    exists (
      select 1 from recipes r
      where r.id = recipe_ingredients.recipe_id
        and is_org_management(r.organization_id)
    )
  )
  with check (
    exists (
      select 1 from recipes r
      where r.id = recipe_ingredients.recipe_id
        and is_org_management(r.organization_id)
    )
  );

drop policy if exists recipe_ingredients_delete_management on recipe_ingredients;
create policy recipe_ingredients_delete_management on recipe_ingredients
  for delete
  using (
    exists (
      select 1 from recipes r
      where r.id = recipe_ingredients.recipe_id
        and is_org_management(r.organization_id)
    )
  );
