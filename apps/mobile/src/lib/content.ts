import { supabase } from './supabase';

export type Resource = {
  id: string;
  organizationId: string;
  category: string;
  title: string;
  description: string | null;
  content: string | null;
  fileUrl: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type Ingredient = {
  id: string;
  organizationId: string;
  name: string;
  category: string | null;
  unit: string | null;
};

export type Recipe = {
  id: string;
  organizationId: string;
  experienceId: string | null;
  name: string;
  yieldAmount: number | null;
  yieldUnit: string | null;
  instructions: string | null;
  createdAt: string;
};

export type RecipeIngredient = {
  id: string;
  recipeId: string;
  ingredientId: string;
  quantity: number | null;
  unit: string | null;
};

function mapResource(row: any): Resource {
  return {
    id: row.id,
    organizationId: row.organization_id,
    category: row.category,
    title: row.title,
    description: row.description,
    content: row.content,
    fileUrl: row.file_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapIngredient(row: any): Ingredient {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    category: row.category,
    unit: row.unit,
  };
}

function mapRecipe(row: any): Recipe {
  return {
    id: row.id,
    organizationId: row.organization_id,
    experienceId: row.experience_id,
    name: row.name,
    yieldAmount: row.yield_amount === null ? null : Number(row.yield_amount),
    yieldUnit: row.yield_unit,
    instructions: row.instructions,
    createdAt: row.created_at,
  };
}

function mapRecipeIngredient(row: any): RecipeIngredient {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    ingredientId: row.ingredient_id,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
  };
}

export async function fetchResources(organizationId: string): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('organization_id', organizationId)
    .order('category', { ascending: true })
    .order('title', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapResource);
}

export async function createResource(input: {
  organizationId: string;
  category: string;
  title: string;
  description?: string;
  content?: string;
  fileUrl?: string;
  createdBy?: string;
}): Promise<Resource> {
  const { data, error } = await supabase
    .from('resources')
    .insert({
      organization_id: input.organizationId,
      category: input.category,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      content: input.content?.trim() || null,
      file_url: input.fileUrl?.trim() || null,
      created_by: input.createdBy || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapResource(data);
}

export async function archiveResource(resourceId: string): Promise<void> {
  const { error } = await supabase
    .from('resources')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', resourceId);
  if (error) throw error;
}

export async function fetchIngredients(organizationId: string): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapIngredient);
}

export async function createIngredient(input: {
  organizationId: string;
  name: string;
  category?: string;
  unit?: string;
}): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      organization_id: input.organizationId,
      name: input.name.trim(),
      category: input.category?.trim() || null,
      unit: input.unit?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapIngredient(data);
}

export async function fetchRecipes(organizationId: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapRecipe);
}

export async function createRecipe(input: {
  organizationId: string;
  experienceId?: string;
  name: string;
  yieldAmount?: number;
  yieldUnit?: string;
  instructions?: string;
}): Promise<Recipe> {
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      organization_id: input.organizationId,
      experience_id: input.experienceId || null,
      name: input.name.trim(),
      yield_amount: input.yieldAmount ?? null,
      yield_unit: input.yieldUnit?.trim() || null,
      instructions: input.instructions?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRecipe(data);
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
  if (error) throw error;
}

export async function fetchRecipeIngredients(recipeId: string): Promise<RecipeIngredient[]> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .eq('recipe_id', recipeId);
  if (error) throw error;
  return (data || []).map(mapRecipeIngredient);
}

export async function addRecipeIngredient(input: {
  recipeId: string;
  ingredientId: string;
  quantity?: number;
  unit?: string;
}): Promise<RecipeIngredient> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .insert({
      recipe_id: input.recipeId,
      ingredient_id: input.ingredientId,
      quantity: input.quantity ?? null,
      unit: input.unit?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRecipeIngredient(data);
}

export async function removeRecipeIngredient(recipeIngredientId: string): Promise<void> {
  const { error } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('id', recipeIngredientId);
  if (error) throw error;
}
