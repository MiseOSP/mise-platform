import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import {
  listReserveInterests,
  updateReserveInterestNotes,
  updateReserveInterestStatus,
  type ReserveInterest,
  type ReserveInterestStatus,
} from '@/lib/memberships';
import { Brand } from '@/constants/theme';

const STAFF_ROLES = ['owner', 'admin', 'manager', 'chef'];

// The forward pipeline for a reserve interest. Each row shows the button that
// advances it to the next stage; 'converted' and 'closed' are terminal.
const NEXT_STATUS: Partial<Record<ReserveInterestStatus, ReserveInterestStatus>> = {
  new: 'contacted',
  contacted: 'consult_scheduled',
  consult_scheduled: 'converted',
};

const STATUS_LABEL: Record<ReserveInterestStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  consult_scheduled: 'Consult scheduled',
  converted: 'Converted',
  closed: 'Closed',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ReserveQueueScreen() {
  const { organizationId, role } = useAuth();
  const isStaff = role != null && STAFF_ROLES.includes(role);

  const [items, setItems] = useState<ReserveInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-row editing state, keyed by interest id.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await listReserveInterests(organizationId);
    if (err) {
      setError(err);
    } else if (data) {
      setItems(data);
      setDrafts(
        Object.fromEntries(data.map((i) => [i.id, i.notes ?? ''])),
      );
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveNotes = useCallback(
    async (id: string) => {
      setSavingId(id);
      const { data, error: err } = await updateReserveInterestNotes(
        id,
        drafts[id]?.trim() ? drafts[id].trim() : null,
      );
      if (!err && data) {
        setItems((prev) => prev.map((i) => (i.id === id ? data : i)));
      } else if (err) {
        setError(err);
      }
      setSavingId(null);
    },
    [drafts],
  );

  const advance = useCallback(
    async (id: string, next: ReserveInterestStatus) => {
      setSavingId(id);
      const { data, error: err } = await updateReserveInterestStatus(id, next);
      if (!err && data) {
        setItems((prev) => prev.map((i) => (i.id === id ? data : i)));
      } else if (err) {
        setError(err);
      }
      setSavingId(null);
    },
    [],
  );

  if (!isStaff) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.muted}>
          This area is for Nashville Chef Service staff.
        </ThemedText>
      </ThemedView>
    );
  }

  const renderItem = ({ item }: { item: ReserveInterest }) => {
    const next = NEXT_STATUS[item.status];
    const busy = savingId === item.id;
    return (
      <ThemedView style={styles.card}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.badge}>{STATUS_LABEL[item.status]}</ThemedText>
          <ThemedText style={styles.muted}>
            {new Date(item.createdAt).toLocaleDateString()}
          </ThemedText>
        </View>

        <ThemedText style={styles.meta}>
          Cadence: {item.desiredCadence ?? '—'}
          {'   '}
          Preferred day:{' '}
          {item.preferredDayOfWeek == null ? '—' : DAYS[item.preferredDayOfWeek]}
        </ThemedText>

        <ThemedText style={styles.label}>Consult notes</ThemedText>
        <TextInput
          style={styles.input}
          value={drafts[item.id] ?? ''}
          onChangeText={(t) =>
            setDrafts((prev) => ({ ...prev, [item.id]: t }))
          }
          placeholder="Add notes from the consult…"
          placeholderTextColor={Brand.textMuted}
          multiline
          editable={!busy}
        />

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void saveNotes(item.id)}
            style={[styles.button, busy && styles.buttonDisabled]}
          >
            <ThemedText style={styles.buttonText}>
              {busy ? 'Saving…' : 'Save notes'}
            </ThemedText>
          </Pressable>

          {next ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void advance(item.id, next)}
              style={[styles.buttonSecondary, busy && styles.buttonDisabled]}
            >
              <ThemedText style={styles.buttonSecondaryText}>
                Mark {STATUS_LABEL[next].toLowerCase()}
              </ThemedText>
            </Pressable>
          ) : null}

          {item.status !== 'closed' && item.status !== 'converted' ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void advance(item.id, 'closed')}
              style={[styles.buttonGhost, busy && styles.buttonDisabled]}
            >
              <ThemedText style={styles.buttonGhostText}>Close</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>NCS Reserve queue</ThemedText>
      <ThemedText style={styles.subtitle}>
        Incoming interest from clients. Add consult notes and advance each one.
      </ThemedText>

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Brand.denim} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <ThemedText style={styles.muted}>
              No reserve interest yet.
            </ThemedText>
          }
          refreshing={loading}
          onRefresh={() => void load()}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: Brand.textMuted, marginBottom: 12 },
  listContent: { paddingBottom: 32, gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: Brand.surface,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.espresso,
    backgroundColor: Brand.denimTint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  meta: { color: Brand.espresso },
  label: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  muted: { color: Brand.textMuted },
  error: { color: Brand.clay, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
    backgroundColor: Brand.cream,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  button: { backgroundColor: Brand.denim, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: Brand.cream, fontWeight: '600' },
  buttonSecondary: {
    backgroundColor: Brand.denimTint,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonSecondaryText: { color: Brand.espresso, fontWeight: '600' },
  buttonGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  buttonGhostText: { color: Brand.textMuted, fontWeight: '600' },
  buttonDisabled: { backgroundColor: Brand.denimDisabled },
});
