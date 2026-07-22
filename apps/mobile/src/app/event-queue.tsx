// Admin event queue / pipeline (Phase 4, spec Sections 22, 30, 90).
// Shows every event in the organization grouped by pipeline stage so an
// operator can see what needs attention. Read-only in this slice; status
// transitions are a separate, server-validated slice (spec Section 51).
// RLS returns all org events for owner/admin/manager; the query shape is the
// same as the Home screen (lib/events.ts fetchEventsForRole).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { EventListItem, fetchEventsForRole } from '@/lib/events';

const STAFF_ROLES = new Set(['owner', 'admin', 'manager']);

// Group the flat spec Section 22 status list into operator-friendly stages.
const STAGES: { key: string; label: string; statuses: string[] }[] = [
  { key: 'new', label: 'New & qualifying', statuses: ['inquiry', 'qualification'] },
  {
    key: 'proposal',
    label: 'Proposal & deposit',
    statuses: ['proposed', 'awaiting_client', 'awaiting_deposit'],
  },
  {
    key: 'prep',
    label: 'Confirmed & prep',
    statuses: ['confirmed', 'staffing', 'planning', 'ready'],
  },
  { key: 'active', label: 'In progress', statuses: ['in_progress'] },
  {
    key: 'closing',
    label: 'Wrap-up & payment',
    statuses: ['completed', 'final_payment_due'],
  },
  { key: 'done', label: 'Closed', statuses: ['closed', 'canceled'] },
];

function stageForStatus(status: string): string {
  const s = STAGES.find((st) => st.statuses.includes(status));
  return s ? s.key : 'other';
}

function prettyStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

export default function EventQueueScreen() {
  const { role, organizationId } = useAuth();
  const isStaff = !!role && STAFF_ROLES.has(role);
  const hasOrg = !!organizationId;

  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<string>('all');

  const load = useCallback(async () => {
    if (!role || !organizationId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchEventsForRole(role, organizationId);
    if (err) setError(err);
    setEvents(data);
    setLoading(false);
  }, [role, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events) {
      const k = stageForStatus(e.status);
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [events]);

  const visible = useMemo(() => {
    if (activeStage === 'all') return events;
    return events.filter((e) => stageForStatus(e.status) === activeStage);
  }, [events, activeStage]);

  if (!hasOrg) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>Join an organization to see the event queue.</Text>
      </View>
    );
  }
  if (!isStaff) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>The event queue is available to staff only.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Event queue</Text>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, activeStage === 'all' && styles.filterChipActive]}
          onPress={() => setActiveStage('all')}>
          <Text style={[styles.filterText, activeStage === 'all' && styles.filterTextActive]}>
            All ({events.length})
          </Text>
        </Pressable>
        {STAGES.map((st) => (
          <Pressable
            key={st.key}
            style={[styles.filterChip, activeStage === st.key && styles.filterChipActive]}
            onPress={() => setActiveStage(st.key)}>
            <Text style={[styles.filterText, activeStage === st.key && styles.filterTextActive]}>
              {st.label} ({counts[st.key] ?? 0})
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listContent}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {item.occasion || 'Event'}
                  {item.guest_count ? ` \u00b7 ${item.guest_count} guests` : ''}
                </Text>
                <Text style={styles.muted}>
                  {item.event_date}
                  {item.start_time ? ` at ${item.start_time}` : ''}
                  {item.city ? ` \u00b7 ${[item.city, item.state].filter(Boolean).join(', ')}` : ''}
                </Text>
              </View>
              <Text style={styles.statusBadge}>{prettyStatus(item.status)}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.muted}>No events in this stage.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  filterChip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterChipActive: { borderColor: '#111', backgroundColor: '#111' },
  filterText: { fontSize: 12, color: '#333' },
  filterTextActive: { color: '#fff' },
  listContent: { paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  statusBadge: { fontSize: 12, fontWeight: '700', color: '#555', marginLeft: 12, textTransform: 'capitalize' },
  muted: { color: '#777', marginTop: 2 },
  errorText: { color: '#b00020', marginBottom: 8 },
});
