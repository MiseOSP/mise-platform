import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import {
  Resource,
  Ingredient,
  Recipe,
  RecipeIngredient,
  fetchResources,
  createResource,
  archiveResource,
  fetchIngredients,
  createIngredient,
  fetchRecipes,
  createRecipe,
  deleteRecipe,
  fetchRecipeIngredients,
  addRecipeIngredient,
  removeRecipeIngredient,
} from '@/lib/content';

const MANAGEMENT_ROLES = new Set(['owner', 'admin', 'manager']);

type SectionKey = 'resources' | 'ingredients' | 'recipes';

function RecipeIngredientsPanel({
  recipeId,
  ingredients,
  isManagement,
}: {
  recipeId: string;
  ingredients: Ingredient[];
  isManagement: boolean;
}) {
  const [items, setItems] = useState<RecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecipeIngredients(recipeId);
      setItems(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load recipe ingredients');
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    load();
  }, [load]);

  const ingredientName = (id: string) =>
    ingredients.find((i) => i.id === id)?.name || 'Unknown ingredient';

  const submitIngredient = async () => {
    if (!selectedIngredientId) return;
    setSaving(true);
    setError(null);
    try {
      await addRecipeIngredient({
        recipeId,
        ingredientId: selectedIngredientId,
        quantity: quantity.trim() ? Number(quantity.trim()) : undefined,
        unit: unit.trim() || undefined,
      });
      setSelectedIngredientId(null);
      setQuantity('');
      setUnit('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to add ingredient');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (recipeIngredientId: string) => {
    setError(null);
    try {
      await removeRecipeIngredient(recipeIngredientId);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to remove ingredient');
    }
  };

  return (
    <View style={styles.expandedBox}>
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading && items.length === 0 ? (
        <Text style={styles.muted}>No ingredients linked yet.</Text>
      ) : null}
      {items.map((ri) => (
        <View key={ri.id} style={styles.ingredientRow}>
          <Text style={styles.body}>
            {ingredientName(ri.ingredientId)}
            {ri.quantity != null ? ` — ${ri.quantity} ${ri.unit || ''}`.trim() : ''}
          </Text>
          {isManagement ? (
            <Pressable onPress={() => remove(ri.id)}>
              <Text style={styles.linkDanger}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {isManagement && ingredients.length > 0 ? (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {ingredients.map((ing) => {
              const selected = selectedIngredientId === ing.id;
              return (
                <Pressable
                  key={ing.id}
                  onPress={() => setSelectedIngredientId(selected ? null : ing.id)}
                  style={[styles.chip, selected && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{ing.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={styles.smallInput}
              placeholder="Qty"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.smallInput}
              placeholder="Unit"
              value={unit}
              onChangeText={setUnit}
            />
            <Pressable
              style={[styles.submitButton, (saving || !selectedIngredientId) && styles.submitButtonDisabled, { flex: 1 }]}
              onPress={submitIngredient}
              disabled={saving || !selectedIngredientId}
            >
              <Text style={styles.submitButtonText}>{saving ? 'Adding...' : 'Add ingredient'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}


export default function LibraryScreen() {
  const { role, organizationId } = useAuth();
  const isManagement = !!role && MANAGEMENT_ROLES.has(role);
  const hasOrg = !!organizationId;

  const [section, setSection] = useState<SectionKey>('resources');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resources, setResources] = useState<Resource[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [r, i, rec] = await Promise.all([
        fetchResources(organizationId),
        fetchIngredients(organizationId),
        fetchRecipes(organizationId),
      ]);
      setResources(r);
      setIngredients(i);
      setRecipes(rec);
    } catch (e: any) {
      setError(e?.message || 'Failed to load content library');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const [newResourceTitle, setNewResourceTitle] = useState('');
  const [newResourceCategory, setNewResourceCategory] = useState('');
  const [newResourceContent, setNewResourceContent] = useState('');
  const [savingResource, setSavingResource] = useState(false);

  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientCategory, setNewIngredientCategory] = useState('');
  const [newIngredientUnit, setNewIngredientUnit] = useState('');
  const [savingIngredient, setSavingIngredient] = useState(false);

  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeYield, setNewRecipeYield] = useState('');
  const [newRecipeYieldUnit, setNewRecipeYieldUnit] = useState('');
  const [savingRecipe, setSavingRecipe] = useState(false);

  const submitResource = async () => {
    if (!newResourceTitle.trim() || !newResourceCategory.trim() || savingResource || !organizationId) return;
    setSavingResource(true);
    try {
      await createResource({
        organizationId,
        category: newResourceCategory,
        title: newResourceTitle,
        content: newResourceContent || undefined,
      });
      setNewResourceTitle('');
      setNewResourceCategory('');
      setNewResourceContent('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to add resource');
    } finally {
      setSavingResource(false);
    }
  };

  const submitIngredient = async () => {
    if (!newIngredientName.trim() || savingIngredient || !organizationId) return;
    setSavingIngredient(true);
    try {
      await createIngredient({
        organizationId,
        name: newIngredientName,
        category: newIngredientCategory || undefined,
        unit: newIngredientUnit || undefined,
      });
      setNewIngredientName('');
      setNewIngredientCategory('');
      setNewIngredientUnit('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to add ingredient');
    } finally {
      setSavingIngredient(false);
    }
  };

  const submitRecipe = async () => {
    if (!newRecipeName.trim() || savingRecipe || !organizationId) return;
    setSavingRecipe(true);
    try {
      await createRecipe({
        organizationId,
        name: newRecipeName,
        yieldAmount: newRecipeYield ? Number(newRecipeYield) : undefined,
        yieldUnit: newRecipeYieldUnit || undefined,
      });
      setNewRecipeName('');
      setNewRecipeYield('');
      setNewRecipeYieldUnit('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to add recipe');
    } finally {
      setSavingRecipe(false);
    }
  };

  const removeResource = async (id: string) => {
    try {
      await archiveResource(id);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to archive resource');
    }
  };

  const removeRecipe = async (id: string) => {
    try {
      await deleteRecipe(id);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete recipe');
    }
  };

  if (!hasOrg) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>Join an organization to see the content library.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Content Library</Text>
      <View style={styles.tabRow}>
        {(['resources', 'ingredients', 'recipes'] as SectionKey[]).map((key) => (
          <Pressable
            key={key}
            style={[styles.tabButton, section === key && styles.tabButtonActive]}
            onPress={() => setSection(key)}
          >
            <Text style={[styles.tabButtonText, section === key && styles.tabButtonTextActive]}>
              {key === 'resources' ? 'Resources' : key === 'ingredients' ? 'Ingredients' : 'Recipes'}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : section === 'resources' ? (
        <FlatList
          data={resources}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            isManagement ? (
              <View style={styles.form}>
                <Text style={styles.formTitle}>New resource</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Category (e.g. Training)"
                  value={newResourceCategory}
                  onChangeText={setNewResourceCategory}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Title"
                  value={newResourceTitle}
                  onChangeText={setNewResourceTitle}
                />
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Content (optional)"
                  value={newResourceContent}
                  onChangeText={setNewResourceContent}
                  multiline
                />
                <Pressable
                  style={[styles.submitButton, savingResource && styles.submitButtonDisabled]}
                  onPress={submitResource}
                  disabled={savingResource}
                >
                  <Text style={styles.submitButtonText}>
                    {savingResource ? 'Adding...' : 'Add resource'}
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.muted}>{item.category}</Text>
                {item.content ? <Text style={styles.body}>{item.content}</Text> : null}
              </View>
              {isManagement ? (
                <Pressable onPress={() => removeResource(item.id)}>
                  <Text style={styles.linkDanger}>Archive</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.muted}>No resources yet.</Text>}
        />
      ) : section === 'ingredients' ? (
        <FlatList
          data={ingredients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            isManagement ? (
              <View style={styles.form}>
                <Text style={styles.formTitle}>New ingredient</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  value={newIngredientName}
                  onChangeText={setNewIngredientName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Category (optional)"
                  value={newIngredientCategory}
                  onChangeText={setNewIngredientCategory}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Unit (optional)"
                  value={newIngredientUnit}
                  onChangeText={setNewIngredientUnit}
                />
                <Pressable
                  style={[styles.submitButton, savingIngredient && styles.submitButtonDisabled]}
                  onPress={submitIngredient}
                  disabled={savingIngredient}
                >
                  <Text style={styles.submitButtonText}>
                    {savingIngredient ? 'Adding...' : 'Add ingredient'}
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.muted}>
                  {[item.category, item.unit].filter(Boolean).join(' \u00b7 ') || '\u2014'}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.muted}>No ingredients yet.</Text>}
        />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            isManagement ? (
              <View style={styles.form}>
                <Text style={styles.formTitle}>New recipe</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  value={newRecipeName}
                  onChangeText={setNewRecipeName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Yield amount (optional)"
                  value={newRecipeYield}
                  onChangeText={setNewRecipeYield}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Yield unit (optional)"
                  value={newRecipeYieldUnit}
                  onChangeText={setNewRecipeYieldUnit}
                />
                <Pressable
                  style={[styles.submitButton, savingRecipe && styles.submitButtonDisabled]}
                  onPress={submitRecipe}
                  disabled={savingRecipe}
                >
                  <Text style={styles.submitButtonText}>
                    {savingRecipe ? 'Adding...' : 'Add recipe'}
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const expanded = expandedRecipeId === item.id;
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.rowTitle}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Pressable onPress={() => setExpandedRecipeId(expanded ? null : item.id)}>
                        <Text style={styles.link}>{expanded ? 'Hide ingredients' : 'Ingredients'}</Text>
                      </Pressable>
                      {isManagement ? (
                        <Pressable onPress={() => removeRecipe(item.id)}>
                          <Text style={styles.linkDanger}>Delete</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.muted}>
                    {item.yieldAmount ? `Yields ${item.yieldAmount} ${item.yieldUnit || ''}`.trim() : 'No yield set'}
                  </Text>
                  {expanded ? (
                    <RecipeIngredientsPanel recipeId={item.id} ingredients={ingredients} isManagement={isManagement} />
                  ) : null}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.muted}>No recipes yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  tabRow: { flexDirection: 'row', marginBottom: 12 },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#eee',
    marginRight: 8,
  },
  tabButtonActive: { backgroundColor: '#111' },
  tabButtonText: { color: '#111', fontWeight: '600' },
  tabButtonTextActive: { color: '#fff' },
  listContent: { paddingBottom: 40 },
  form: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f7f7f7',
  },
  formTitle: { fontWeight: '700', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  submitButton: {
    backgroundColor: '#111',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  body: { marginTop: 4, color: '#333' },
  muted: { color: '#777', marginTop: 2 },
  errorText: { color: '#b00020', marginBottom: 8 },
  linkDanger: { color: '#b00020', fontWeight: '600', marginLeft: 12 },
  link: { color: '#2a6df5', fontWeight: '600', marginLeft: 12 },
  expandedBox: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd' },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipActive: { borderColor: '#111', backgroundColor: '#111' },
  chipText: { fontSize: 12, color: '#333' },
  chipTextActive: { color: '#fff' },
  smallInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    minWidth: 60,
  },
});
