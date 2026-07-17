import { supabase } from './supabase';

// Catalog of bookable "experiences" (packages) an org offers, each made up of
// menu categories -> menu items. Read access: any active org member sees
// active, non-deleted rows. Write access: management only (enforced by RLS
// migration 011; these helpers assume the caller has already checked role
// client-side for a good UX, but the database is the real gatekeeper).

export type Experience = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  startingPrice: number | null;
  imageUrl: string | null;
  active: boolean;
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
