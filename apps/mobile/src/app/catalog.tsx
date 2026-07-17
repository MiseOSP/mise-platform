import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import {
  createExperience,
  createMenuCategory,
  createMenuItem,
  fetchExperiences,
  fetchMenuCategories,
  fetchMenuItems,
  setExperienceActive,
  setMenuItemActive,
  type Experience,
  type MenuCategory,
  type MenuItem,
} from '@/lib/experiences';

const MANAGEMENT_ROLES = new Set(['owner', 'admin', 'manager']);

function ExperienceRow({
  experience,
  isManagement,
  onChanged,
}: {
  experience: Experience;
  isManagement: boolean;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [itemsByCategory, setItemsByCategory] = useState<Record<string, MenuItem[]>>({});
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newItemNameByCategory, setNewItemNameByCategory] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setError(null);
    try {
      const cats = await fetchMenuCategories(experience.id);
      setCategories(cats);
      const entries = await Promise.all(
        cats.map(async (c) => [c.id, await fetchMenuItems(c.id)] as const)
      );
      setItemsByCategory(Object.fromEntries(entries));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load menu.');
    } finally {
      setLoadingCatalog(false);
    }
  }, [experience.id]);

  useEffect(() => {
    if (expanded) loadCatalog();
  }, [expanded, loadCatalog]);

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setExpanded((v) => !v)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{experience.name}</Text>
          {experience.startingPrice !== null && (
            <Text style={styles.price}>from ${experience.startingPrice.toFixed(2)}</Text>
          )}
        </View>
        {experience.description && <Text style={styles.muted}>{experience.description}</Text>}
      </Pressable>

      {isManagement && (
        <View style={styles.row}>
          <Text style={styles.muted}>Active</Text>
          <Switch
            value={experience.active}
            onValueChange={async (v) => {
              try {
                await setExperienceActive(experience.id, v);
                onChanged();
              } catch (e: any) {
                setError(e.message ?? 'Failed to update.');
              }
            }}
          />
        </View>
      )}

      {expanded && (
        <View style={styles.catalogSection}>
          {loadingCatalog && <ActivityIndicator />}
          {error && <Text style={styles.error}>{error}</Text>}
          {categories.map((cat) => (
            <View key={cat.id} style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>{cat.name}</Text>
              {(itemsByCategory[cat.id] ?? []).map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={item.active ? styles.itemName : styles.itemNameInactive}>
                    {item.name}
                    {item.priceModifier ? ` (+$${item.priceModifier.toFixed(2)})` : ''}
                  </Text>
                  {isManagement && (
                    <Switch
                      value={item.active}
                      onValueChange={async (v) => {
                        try {
                          await setMenuItemActive(item.id, v);
                          loadCatalog();
                        } catch (e: any) {
                          setError(e.message ?? 'Failed to update.');
                        }
                      }}
                    />
                  )}
                </View>
              ))}
              {isManagement && (
                <View style={styles.inlineForm}>
                  <TextInput
                    style={styles.inlineInput}
                    placeholder="New menu item name"
                    value={newItemNameByCategory[cat.id] ?? ''}
                    onChangeText={(t) =>
                      setNewItemNameByCategory((prev) => ({ ...prev, [cat.id]: t }))
                    }
                  />
                  <Pressable
                    disabled={busy}
                    style={styles.smallButton}
                    onPress={async () => {
                      const name = (newItemNameByCategory[cat.id] ?? '').trim();
                      if (!name) return;
                      setBusy(true);
                      try {
                        await createMenuItem({ categoryId: cat.id, name });
                        setNewItemNameByCategory((prev) => ({ ...prev, [cat.id]: '' }));
                        await loadCatalog();
                      } catch (e: any) {
                        setError(e.message ?? 'Failed to add item.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Text style={styles.smallButtonText}>Add item</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}

          {isManagement && (
            <View style={styles.inlineForm}>
              <TextInput
                style={styles.inlineInput}
                placeholder="New category name"
                value={newCategoryName}
                onChangeText={setNewCategoryName}
              />
              <Pressable
                disabled={busy}
                style={styles.smallButton}
                onPress={async () => {
                  const name = newCategoryName.trim();
                  if (!name) return;
                  setBusy(true);
                  try {
                    await createMenuCategory({ experienceId: experience.id, name });
                    setNewCategoryName('');
                    await loadCatalog();
                  } catch (e: any) {
                    setError(e.message ?? 'Failed to add category.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Text style={styles.smallButtonText}>Add category</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function CatalogScreen() {
  const { role, organizationId } = useAuth();
  const isManagement = !!role && MANAGEMENT_ROLES.has(role);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      setExperiences(await fetchExperiences(organizationId));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load experiences.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!organizationId) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>Join an organization to see its catalog.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Experiences</Text>
      {loading && <ActivityIndicator />}
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={experiences}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <ExperienceRow experience={item} isManagement={isManagement} onChanged={load} />
        )}
        ListEmptyComponent={!loading ? <Text style={styles.muted}>No experiences yet.</Text> : null}
      />

      {isManagement && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>New experience</Text>
          <TextInput
            style={styles.input}
            placeholder="Name (e.g. Chef's Table Dinner)"
            value={newName}
            onChangeText={setNewName}
          />
          <TextInput
            style={styles.input}
            placeholder="Starting price (optional)"
            value={newPrice}
            onChangeText={setNewPrice}
            keyboardType="decimal-pad"
          />
          <Pressable
            disabled={creating}
            style={styles.button}
            onPress={async () => {
              const name = newName.trim();
              if (!name || !organizationId) return;
              setCreating(true);
              setError(null);
              try {
                await createExperience({
                  organizationId,
                  name,
                  startingPrice: newPrice ? Number(newPrice) : undefined,
                });
                setNewName('');
                setNewPrice('');
                await load();
              } catch (e: any) {
                setError(e.message ?? 'Failed to create experience.');
              } finally {
                setCreating(false);
              }
            }}
          >
            <Text style={styles.buttonText}>Add experience</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  muted: { color: '#666' },
  error: { color: '#b00020', marginVertical: 4 },
  card: {
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  price: { color: '#444' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  catalogSection: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
  categoryBlock: { marginBottom: 10 },
  categoryTitle: { fontWeight: '600', marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  itemName: { color: '#111' },
  itemNameInactive: { color: '#999', textDecorationLine: 'line-through' },
  inlineForm: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  inlineInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  smallButton: { backgroundColor: '#222', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  smallButtonText: { color: '#fff', fontSize: 12 },
  form: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12, marginTop: 8 },
  formTitle: { fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  button: { backgroundColor: '#222', borderRadius: 6, paddingVertical: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
