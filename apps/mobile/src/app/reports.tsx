// Reporting foundation / operations dashboard (Phase 4, spec Sections 16, 22, 30, 51, 90).
// Read-only summary tiles computed from data the admin can already see: event
// pipeline counts, upcoming-event count, and relationship pipeline counts. This
// is a lightweight foundation -- richer reporting (revenue over time, cohort
// analysis) is future work. All numbers are derived from RLS-scoped reads
// (spec S51); nothing here is authoritative for money.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { EventListItem, fetchEventsForRole } from '@/lib/events';
import { Relationship, listRelationships } from '@/lib/relationships';

const STAFF_ROLES = new Set(['owner', 'admin', 'manager']);

// Same operator stages used by the event queue screen (spec Section 22).
const STAGES: { key: string; label: string; statuses: string[] }[] = [
  { key: 'new', label: 'New & qualifying', statuses: ['inquiry', 'qualification'] },
  {
    key: 'proposal',
    label: 'Proposal & deposit',
    statuses: ['proposed', 'awaiting_client', 'awaiting_deposit'],
  },
  { key: 'prep', label: 'Confirmed & prep', statuses: ['confirmed', 'staffing', 'planning', 'ready'] },
  { key: 'active', label: 'In progress', statuses: ['in_progress'] },
  { key: 'closing', label: 'Wrap-up & payment', statuses: ['completed', 'final_payment_due'] },
  { key: 'done', label: 'Closed', statuses: ['closed', 'canceled'] },
];

const LEAD_ORDER = ['inquiry', 'qualifying', 'active', 'dormant', 'lost'];
const CLIENT_ORDER = ['prospect', 'one_time', 'member', 'former'];

function todayYmd(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function pretty(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function ReportsScreen() {
  const { role, organizationId } = useAuth();
  const isStaff = !!role && STAFF_ROLES.has(role);
  const hasOrg = !!organizationId;

  const [events, setEvents] = useState<EventListItem[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!role || !organizationId) return;
    setError(null);
    try {
      const [evRes, relRes] = await Promise.all([
        fetchEventsForRole(role, organizationId),
        listRelationships(organizationId),
      ]);
      if (evRes.error) throw new Error(evRes.error);
      if (relRes.error) throw new Error(relRes.error);
      setEvents(evRes.data ?? []);
      setRelationships(relRes.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const stageCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const st of STAGES) map[st.key] = 0;
    for (const e of events) {
      const st = STAGES.find((s) => s.statuses.includes(e.status));
      if (st) map[st.key] += 1;
    }
    return map;
  }, [events]);

  const upcomingCount = useMemo(() => {
    const today = todayYmd();
    return events.filter((e) => e.event_date && e.event_date >= today).length;
  }, [events]);

  const leadCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of relationships) map[r.leadStatus] = (map[r.leadStatus] ?? 0) + 1;
    return map;
  }, [relationships]);

  const clientCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of relationships) map[r.clientStatus] = (map[r.clientStatus] ?? 0) + 1;
    return map;
  }, [relationships]);

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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.heading}>Overview</Text>
      <View style={styles.tileRow}>
        <View style={styles.tile}>
          <Text style={styles.tileNumber}>{events.length}</Text>
          <Text style={styles.tileLabel}>Total events</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileNumber}>{upcomingCount}</Text>
          <Text style={styles.tileLabel}>Upcoming</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileNumber}>{relationships.length}</Text>
          <Text style={styles.tileLabel}>Relationships</Text>
        </View>
      </View>

      <Text style={styles.section}>Event pipeline</Text>
      {STAGES.map((st) => (
        <View key={st.key} style={styles.statRow}>
          <Text style={styles.statLabel}>{st.label}</Text>
          <Text style={styles.statValue}>{stageCounts[st.key] ?? 0}</Text>
        </View>
      ))}

      <Text style={styles.section}>Lead status</Text>
      {LEAD_ORDER.map((k) => (
        <View key={k} style={styles.statRow}>
          <Text style={styles.statLabel}>{pretty(k)}</Text>
          <Text style={styles.statValue}>{leadCounts[k] ?? 0}</Text>
        </View>
      ))}

      <Text style={styles.section}>Client status</Text>
      {CLIENT_ORDER.map((k) => (
        <View key={k} style={styles.statRow}>
          <Text style={styles.statLabel}>{pretty(k)}</Text>
          <Text style={styles.statValue}>{clientCounts[k] ?? 0}</Text>
        </View>
      ))}

      <Text style={styles.footnote}>
        Counts reflect what you can access. Richer reporting is coming later.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  section: { fontSize: 15, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  tileRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tileNumber: { fontSize: 26, fontWeight: '700', color: '#111827' },
  tileLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  statLabel: { fontSize: 14, color: '#374151' },
  statValue: { fontSize: 14, fontWeight: '600' },
  muted: { color: '#6b7280' },
  error: { color: '#dc2626', marginBottom: 12 },
  footnote: { fontSize: 12, color: '#9ca3af', marginTop: 24, fontStyle: 'italic' },
});
