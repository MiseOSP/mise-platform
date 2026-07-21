import { supabase } from './supabase';

// Catalog of bookable "experiences" (packages) an org offers, each made up of
// menu categories -> menu items. Read access: any active org member sees
// active, non-deleted rows. Write access: management only (enforced by RLS
// migration 011; these helpers assume the caller has already checked role
// client-side for a good UX, but the database is the real gatekeeper).
//
// Public discovery (v2.0 Sections 28, 34): experiences an operator has opted
// into public listing (public_listed = true) are readable by anon through the
// experiences_select_public policy added in migration 025. fetchPublicExperiences
// below is the read path for the unauthenticated Signature Experience discovery
// screen; it selects only marketing-safe fields.

export type Experience = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  startingPrice: number | null;
  imageUrl: string | null;
  active: boolean;
};

// Public-facing marketing view of an experience for the discovery screen
// (v2.0 Section 34). Only fields safe to expose to anonymous visitors.
export type PublicExperience = {
  id: string;
  name: string;
  description: string | null;
  positioning: string | null;
  serviceFormat: string | null;
  typicalGroupSize: string | null;
  leadTimeNote: string | null;
  dietaryStatement: string | null;
  startingPrice: number | null;
  imageUrl: string | null;
  displayOrder: number;
};

export type MenuCategory = {
  id: string;
  experienceId: string;
  name: string;
  displayOrder: number;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceModifier: number;
  active: boolean;
};

function mapExperience(row: any): Experience {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    startingPrice: row.starting_price === null ? null : Number(row.starting_price),
    imageUrl: row.image_url,
    active: row.active,
  };
}

function mapPublicExperience(row: any): PublicExperience {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    positioning: row.positioning,
    serviceFormat: row.service_format,
    typicalGroupSize: row.typical_group_size,
    leadTimeNote: row.lead_time_note,
    dietaryStatement: row.dietary_statement,
    startingPrice: row.starting_price === null ? null : Number(row.starting_price),
    imageUrl: row.image_url,
    displayOrder: row.display_order ?? 0,
  };
}

function mapCategory(row: any): MenuCategory {
  return {
    id: row.id,
    experienceId: row.experience_id,
    name: row.name,
    displayOrder: row.display_order,
  };
}

function mapMenuItem(row: any): MenuItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    priceModifier: Number(row.price_modifier),
    active: row.active,
  };
}

export async function fetchExperiences(organizationId: string): Promise<Experience[]> {
  const { data, error } = await supabase
    .from('experiences')
    .select('id, organization_id, name, description, starting_price, image_url, active')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return (data ?? []).map(mapExperience);
}

// Public Signature Experience discovery (v2.0 Sections 28, 34). Readable
// WITHOUT a session via the experiences_select_public RLS policy (migration
// 025), which returns only public_listed + active + non-deleted rows. We scope
// by organizationId so a given brand's front door shows its own experiences;
// the org id comes from public config, not a hard-coded value (v2.0 Section 98).
export async function fetchPublicExperiences(
  organizationId: string,
): Promise<PublicExperience[]> {
  const { data, error } = await supabase
    .from('experiences')
    .select(
      'id, name, description, positioning, service_format, typical_group_size, lead_time_note, dietary_statement, starting_price, image_url, display_order',
    )
    .eq('organization_id', organizationId)
    .eq('public_listed', true)
    .eq('active', true)
    .is('deleted_at', null)
    .order('display_order')
    .order('name');
  if (error) throw error;
  return (data ?? []).map(mapPublicExperience);
}

export async function createExperience(input: {
  organizationId: string;
  name: string;
  description?: string;
  startingPrice?: number;
}): Promise<void> {
  const { error } = await supabase.from('experiences').insert({
    organization_id: input.organizationId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    starting_price: input.startingPrice ?? null,
  });
  if (error) throw error;
}

export async function setExperienceActive(experienceId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('experiences').update({ active }).eq('id', experienceId);
  if (error) throw error;
}

export async function fetchMenuCategories(experienceId: string): Promise<MenuCategory[]> {
  const { data, error } = await supabase
    .from('menu_categories')
    .select('id, experience_id, name, display_order')
    .eq('experience_id', experienceId)
    .is('deleted_at', null)
    .order('display_order');
  if (error) throw error;
  return (data ?? []).map(mapCategory);
}

export async function createMenuCategory(input: {
  experienceId: string;
  name: string;
  displayOrder?: number;
}): Promise<void> {
  const { error } = await supabase.from('menu_categories').insert({
    experience_id: input.experienceId,
    name: input.name.trim(),
    display_order: input.displayOrder ?? 0,
  });
  if (error) throw error;
}

export async function fetchMenuItems(categoryId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, category_id, name, description, price_modifier, active')
    .eq('category_id', categoryId)
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return (data ?? []).map(mapMenuItem);
}

export async function createMenuItem(input: {
  categoryId: string;
  name: string;
  description?: string;
  priceModifier?: number;
}): Promise<void> {
  const { error } = await supabase.from('menu_items').insert({
    category_id: input.categoryId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    price_modifier: input.priceModifier ?? 0,
  });
  if (error) throw error;
}

export async function setMenuItemActive(menuItemId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('menu_items').update({ active }).eq('id', menuItemId);
  if (error) throw error;
}
