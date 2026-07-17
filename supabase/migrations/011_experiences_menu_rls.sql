-- 011 experiences & menu catalog RLS
-- experiences: an org's bookable "experience" packages (e.g. "Chef's Table Dinner").
-- menu_categories/menu_items: catalog items nested under an experience.
-- event_menu_items: line items attached to a specific event (quantity + price adjustment).
-- Visibility: any active org member sees active, non-deleted catalog entries (to browse when
-- building an event). Management (owner/admin/manager) sees everything, including inactive/
-- soft-deleted rows, and is the only role that can create/edit the catalog. event_menu_items
-- follow event visibility (can_access_event, from migration 010) for reads; only management
-- may attach/detach menu items to an event.

alter table experiences enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table event_menu_items enable row level security;

drop policy if exists experiences_select_members on experiences;
drop policy if exists experiences_select_management on experiences;
drop policy if exists experiences_insert_management on experiences;
drop policy if exists experiences_update_management on experiences;

create policy experiences_select_members on experiences
for select
using (
  deleted_at is null
  and active = true
  and is_org_member(organization_id)
);

create policy experiences_select_management on experiences
for select
using (is_org_management(organization_id));

create policy experiences_insert_management on experiences
for insert
with check (is_org_management(organization_id));

create policy experiences_update_management on experiences
for update
using (is_org_management(organization_id))
with check (is_org_management(organization_id));

drop policy if exists menu_categories_select_members on menu_categories;
drop policy if exists menu_categories_select_management on menu_categories;
drop policy if exists menu_categories_insert_management on menu_categories;
drop policy if exists menu_categories_update_management on menu_categories;

create policy menu_categories_select_members on menu_categories
for select
using (
  deleted_at is null
  and exists (
    select 1 from experiences e
    where e.id = menu_categories.experience_id
      and e.deleted_at is null
      and e.active = true
      and is_org_member(e.organization_id)
  )
);

create policy menu_categories_select_management on menu_categories
for select
using (
  exists (
    select 1 from experiences e
    where e.id = menu_categories.experience_id
      and is_org_management(e.organization_id)
  )
);

create policy menu_categories_insert_management on menu_categories
for insert
with check (
  exists (
    select 1 from experiences e
    where e.id = menu_categories.experience_id
      and is_org_management(e.organization_id)
  )
);

create policy menu_categories_update_management on menu_categories
for update
using (
  exists (
    select 1 from experiences e
    where e.id = menu_categories.experience_id
      and is_org_management(e.organization_id)
  )
)
with check (
  exists (
    select 1 from experiences e
    where e.id = menu_categories.experience_id
      and is_org_management(e.organization_id)
  )
);

drop policy if exists menu_items_select_members on menu_items;
drop policy if exists menu_items_select_management on menu_items;
drop policy if exists menu_items_insert_management on menu_items;
drop policy if exists menu_items_update_management on menu_items;

create policy menu_items_select_members on menu_items
for select
using (
  deleted_at is null
  and active = true
  and exists (
    select 1 from menu_categories mc
    join experiences e on e.id = mc.experience_id
    where mc.id = menu_items.category_id
      and mc.deleted_at is null
      and e.deleted_at is null
      and e.active = true
      and is_org_member(e.organization_id)
  )
);

create policy menu_items_select_management on menu_items
for select
using (
  exists (
    select 1 from menu_categories mc
    join experiences e on e.id = mc.experience_id
    where mc.id = menu_items.category_id
      and is_org_management(e.organization_id)
  )
);

create policy menu_items_insert_management on menu_items
for insert
with check (
  exists (
    select 1 from menu_categories mc
    join experiences e on e.id = mc.experience_id
    where mc.id = menu_items.category_id
      and is_org_management(e.organization_id)
  )
);

create policy menu_items_update_management on menu_items
for update
using (
  exists (
    select 1 from menu_categories mc
    join experiences e on e.id = mc.experience_id
    where mc.id = menu_items.category_id
      and is_org_management(e.organization_id)
  )
)
with check (
  exists (
    select 1 from menu_categories mc
    join experiences e on e.id = mc.experience_id
    where mc.id = menu_items.category_id
      and is_org_management(e.organization_id)
  )
);

drop policy if exists event_menu_items_select_participant on event_menu_items;
drop policy if exists event_menu_items_manage_management on event_menu_items;

create policy event_menu_items_select_participant on event_menu_items
for select
using (can_access_event(event_id));

create policy event_menu_items_manage_management on event_menu_items
for all
using (
  exists (
    select 1 from events ev
    where ev.id = event_menu_items.event_id
      and is_org_management(ev.organization_id)
  )
)
with check (
  exists (
    select 1 from events ev
    where ev.id = event_menu_items.event_id
      and is_org_management(ev.organization_id)
  )
);
