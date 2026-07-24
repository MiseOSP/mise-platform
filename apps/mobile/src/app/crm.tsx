// CRM / relationships admin screen (Phase 4, spec Sections 9, 16, 19, 51, 90).
// Read-only: lists the organization's relationships (the enduring client record)
// with lead-status filter chips, and a detail view with referral source,
// lifetime value, notes, and last interaction. RLS governs access server-side
// (spec S51/S60 -- UI visibility is not authorization). Editing lead/client
// status is a separate server-validated slice (relationships.ts has no update
// helper yet), so this slice surfaces the data only.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import {
  LeadStatus,
  Relationship,
  listRelationships,
} from '@/lib/relationships';

const STAFF_ROLES = new Set(['owner', 'admin', 'manager']);

const LEAD_FILTERS: { key: LeadStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'inquiry', label: 'Inquiry' },
  { key: 'qualifying', label: 'Qualifying' },
  { key: 'active', label: 'Active' },
  { key: 'dormant', label: 'Dormant' },
  { key: 'lost', label: 'Lost' },
];

function money(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function pretty(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CrmScreen() {
  const { role, organizationId } = useAuth();
  const isStaff = !!role && STAFF_ROLES.has(role);
  const hasOrg = !!organizationId;

  const [rows, setRows] = useState<Relationship[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await listRelationships(organizationId);
      if (err) throw new Error(err);
      setRows(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load relationships.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.leadStatus] = (c[r.leadStatus] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.leadStatus === filter)),
    [rows, filter]
  );

  if (!isStaff) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>This screen is for staff only.</Text>
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  if (selected) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => setSelectedId(null)}>
          <Text style={styles.back}>{'< Back to list'}</Text>
        </Pressable>
        <Text style={styles.heading}>{selected.displayName}</Text>
        <Text style={styles.subtle}>{pretty(selected.relationshipType)}</Text>

        <View style={styles.detailCard}>
          <DetailRow label="Lead status" value={pretty(selected.leadStatus)} />
          <DetailRow label="Client status" value={pretty(selected.clientStatus)} />
          <DetailRow
            label="Referral source"
            value={selected.referralSource ? pretty(selected.referralSource) : '-'}
          />
          <DetailRow
            label="Lifetime value"
            value={money(selected.lifetimeValueCents, selected.currency)}
          />
          <DetailRow label="Last interaction" value={formatDate(selected.lastInteractionAt)} />
          <DetailRow label="Created" value={formatDate(selected.createdAt)} />
        </View>

        <Text style={styles.section}>Notes</Text>
        <Text style={styles.notes}>
          {selected.importantNotes?.trim() || 'No notes recorded.'}
        </Text>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.heading}>Relationships</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        {LEAD_FILTERS.map((f) => {
          const active = filter === f.key;
          const n = counts[f.key] ?? 0;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label} ({n})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={<Text style={styles.muted}>No relationships in this view.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => setSelectedId(item.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.displayName}</Text>
              <Text style={styles.rowMeta}>
                {pretty(item.leadStatus)} - {pretty(item.clientStatus)}
              </Text>
            </View>
            <Text style={styles.rowMeta}>{money(item.lifetimeValueCents, item.currency)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  subtle: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  section: { fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  back: { color: '#2563eb', marginBottom: 12 },
  chipRow: { marginBottom: 12, flexGrow: 0 },
  chipRowContent: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#9ca3af',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#ffffff' },
  detailCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { fontSize: 14, color: '#374151' },
  detailValue: { fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  notes: { fontSize: 14, color: '#374151', lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d5db',
  },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  muted: { color: '#6b7280' },
  error: { color: '#dc2626', marginBottom: 12 },
});
