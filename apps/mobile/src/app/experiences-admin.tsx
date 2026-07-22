// Experience / menu administration screen (Phase 4, spec Sections 11, 28, 34, 51, 90).
// Management-only. Three drill-down levels: experiences -> menu categories ->
// menu items. Supports creating rows and toggling active state. Writes are
// gated by RLS (migration 011) server-side; the role check here is only for UX
// (spec S51 -- UI visibility is not authorization).
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  Experience,
  MenuCategory,
  MenuItem,
  createExperience,
  createMenuCategory,
  createMenuItem,
  fetchExperiences,
  fetchMenuCategories,
  fetchMenuItems,
  setExperienceActive,
  setMenuItemActive,
} from '@/lib/experiences';

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);

type Level =
  | { kind: 'experiences' }
  | { kind: 'categories'; experience: Experience }
  | { kind: 'items'; experience: Experience; category: MenuCategory };

export default function ExperiencesAdminScreen() {
  const { role, organizationId } = useAuth();
  const canManage = !!role && MANAGER_ROLES.has(role);
  const hasOrg = !!organizationId;

  const [level, setLevel] = useState<Level>({ kind: 'experiences' });
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const loadExperiences = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      setExperiences(await fetchExperiences(organizationId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load experiences.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const loadCategories = useCallback(async (experienceId: string) => {
    setLoading(true);
    setError(null);
    try {
      setCategories(await fetchMenuCategories(experienceId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItems = useCallback(async (categoryId: string) => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchMenuItems(categoryId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load menu items.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (level.kind === 'experiences') loadExperiences();
    else if (level.kind === 'categories') loadCategories(level.experience.id);
    else loadItems(level.category.id);
  }, [level, loadExperiences, loadCategories, loadItems]);

  const refresh = useCallback(() => {
    if (level.kind === 'experiences') loadExperiences();
    else if (level.kind === 'categories') loadCategories(level.experience.id);
    else loadItems(level.category.id);
  }, [level, loadExperiences, loadCategories, loadItems]);

  const onAdd = useCallback(async () => {
    const name = newName.trim();
    if (!name || !organizationId) return;
    setBusy(true);
    try {
      if (level.kind === 'experiences') {
        await createExperience({ organizationId, name });
      } else if (level.kind === 'categories') {
        await createMenuCategory({ experienceId: level.experience.id, name });
      } else {
        await createMenuItem({ categoryId: level.category.id, name });
      }
      setNewName('');
      refresh();
    } catch (e) {
      Alert.alert('Could not add', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }, [newName, organizationId, level, refresh]);

  const onToggleExperience = useCallback(
    async (exp: Experience, active: boolean) => {
      setBusy(true);
      try {
        await setExperienceActive(exp.id, active);
        refresh();
      } catch (e) {
        Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again.');
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const onToggleItem = useCallback(
    async (item: MenuItem, active: boolean) => {
      setBusy(true);
      try {
        await setMenuItemActive(item.id, active);
        refresh();
      } catch (e) {
        Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again.');
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  if (!canManage) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>This screen is for managers and owners.</Text>
      </View>
    );
  }

  if (!hasOrg) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>No organization selected.</Text>
      </View>
    );
  }

  const title =
    level.kind === 'experiences'
      ? 'Experiences'
      : level.kind === 'categories'
      ? level.experience.name
      : level.category.name;

  const addPlaceholder =
    level.kind === 'experiences'
      ? 'New experience name'
      : level.kind === 'categories'
      ? 'New category name'
      : 'New menu item name';

  return (
    <View style={styles.container}>
      {level.kind !== 'experiences' ? (
        <Pressable
          onPress={() =>
            setLevel(
              level.kind === 'items'
                ? { kind: 'categories', experience: level.experience }
                : { kind: 'experiences' }
            )
          }
        >
          <Text style={styles.back}>{'< Back'}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.heading}>{title}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder={addPlaceholder}
          value={newName}
          onChangeText={setNewName}
        />
        <Pressable
          style={[styles.addBtn, (busy || !newName.trim()) && styles.addBtnDisabled]}
          disabled={busy || !newName.trim()}
          onPress={onAdd}
        >
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : level.kind === 'experiences' ? (
        <FlatList
          data={experiences}
          keyExtractor={(e) => e.id}
          ListEmptyComponent={<Text style={styles.muted}>No experiences yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => setLevel({ kind: 'categories', experience: item })}
              >
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.active ? 'Active' : 'Inactive'}
                  {item.startingPrice != null ? ` - from $${item.startingPrice}` : ''}
                </Text>
              </Pressable>
              <Switch
                value={item.active}
                disabled={busy}
                onValueChange={(v) => onToggleExperience(item, v)}
              />
            </View>
          )}
        />
      ) : level.kind === 'categories' ? (
        <FlatList
          data={categories}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={<Text style={styles.muted}>No categories yet.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                setLevel({ kind: 'items', experience: level.experience, category: item })
              }
            >
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.chev}>{'>'}</Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={<Text style={styles.muted}>No menu items yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.priceModifier ? `+$${item.priceModifier}` : 'No price change'}
                </Text>
              </View>
              <Switch
                value={item.active}
                disabled={busy}
                onValueChange={(v) => onToggleItem(item, v)}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  back: { color: '#2563eb', marginBottom: 12 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#9ca3af',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: '#9ca3af' },
  addBtnText: { color: '#ffffff', fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d5db',
  },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  chev: { fontSize: 18, color: '#9ca3af' },
  muted: { color: '#6b7280' },
  error: { color: '#dc2626', marginBottom: 12 },
});
