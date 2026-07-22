import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { EventListItem, fetchEventsForRole } from '@/lib/events';
import { respondToAssignment } from '@/lib/assignments';

// Chef Portal (Phase 5, spec S91): a chef's read view of the events they are
// assigned to, plus accept/decline. The list comes from the masked
// `chef_visible_events` view via fetchEventsForRole('chef', ...) -- the address
// stays hidden until ~15h before the event (server-enforced, spec S51/S60).
// Accept/decline calls respondToAssignment, which RLS restricts to the chef's
// own assignment row (migration 008). UI visibility is never authorization.

type FilterKey = 'pending' | 'upcoming' | 'all';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'pending', label: 'Needs response' },
  { key: 'upcoming', label: 'Accepted' },
  { key: 'all', label: 'All' },
];

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'accepted':
      return 'Accepted';
    case 'declined':
      return 'Declined';
    case 'pending':
      return 'Awaiting your response';
    default:
      return status || 'Unknown';
  }
}

export default function MyAssignmentsScreen() {
  const { role, organizationId } = useAuth();
  const isChef = role === 'chef';
  const hasOrg = !!organizationId;

  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setError(null);
    try {
      const { data, error: fetchError } = await fetchEventsForRole('chef', organizationId);
      if (fetchError) {
        setError(fetchError);
      } else {
        setEvents(data);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load your assignments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const respond = async (assignmentId: string, accept: boolean) => {
    setRespondingId(assignmentId);
    setError(null);
    try {
      await respondToAssignment(assignmentId, accept);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to send your response');
    } finally {
      setRespondingId(null);
    }
  };

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filter === 'pending') return e.assignment_status === 'pending';
      if (filter === 'upcoming') {
        const d = new Date(e.event_date + 'T00:00:00');
        return e.assignment_status === 'accepted' && d.getTime() >= today.getTime();
      }
      return true;
    });
  }, [events, filter, today]);

  if (!isChef) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>My Assignments</Text>
        <Text style={styles.muted}>This screen is for chefs. Your account role does not have chef assignments.</Text>
      </View>
    );
  }

  if (!hasOrg) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>My Assignments</Text>
        <Text style={styles.muted}>Join an organization to see your assignments.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Assignments</Text>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const pending = item.assignment_status === 'pending';
            const busy = respondingId === item.assignmentId;
            return (
              <View style={styles.row}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.rowTitle}>{item.occasion || 'Event'}</Text>
                  <Text style={styles.date}>{formatDate(item.event_date)}</Text>
                </View>
                <Text style={styles.muted}>
                  {[item.start_time || null, item.guest_count ? `${item.guest_count} guests` : null]
                    .filter(Boolean)
                    .join(' \u00b7 ') || '\u2014'}
                </Text>
                <Text style={styles.muted}>
                  {item.address
                    ? [item.address, item.city, item.state].filter(Boolean).join(', ')
                    : [item.city, item.state].filter(Boolean).join(', ') || 'Location shared closer to the event'}
                </Text>
                <Text style={[styles.statusBadge, pending && styles.statusPending, item.assignment_status === 'accepted' && styles.statusAccepted, item.assignment_status === 'declined' && styles.statusDeclined]}>
                  {statusLabel(item.assignment_status)}
                </Text>

                {pending && item.assignmentId ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.acceptButton, busy && styles.buttonDisabled]}
                      disabled={busy}
                      onPress={() => respond(item.assignmentId as string, true)}
                    >
                      <Text style={styles.acceptButtonText}>{busy ? '...' : 'Accept'}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.declineButton, busy && styles.buttonDisabled]}
                      disabled={busy}
                      onPress={() => respond(item.assignmentId as string, false)}
                    >
                      <Text style={styles.declineButtonText}>{busy ? '...' : 'Decline'}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.muted}>
              {filter === 'pending'
                ? 'Nothing needs your response right now.'
                : filter === 'upcoming'
                ? 'No upcoming accepted events.'
                : 'You have no assignments yet.'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  filterRow: { flexDirection: 'row', marginBottom: 12 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#eee',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#111' },
  chipText: { color: '#111', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  listContent: { paddingBottom: 40 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  date: { color: '#333', fontWeight: '600', marginLeft: 8 },
  muted: { color: '#777', marginTop: 2 },
  statusBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
    backgroundColor: '#eee',
  },
  statusPending: { backgroundColor: '#fdecc8', color: '#8a6100' },
  statusAccepted: { backgroundColor: '#d6f5df', color: '#0f7a34' },
  statusDeclined: { backgroundColor: '#f8d7da', color: '#b00020' },
  actionRow: { flexDirection: 'row', marginTop: 10 },
  acceptButton: {
    backgroundColor: '#111',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginRight: 10,
  },
  acceptButtonText: { color: '#fff', fontWeight: '700' },
  declineButton: {
    borderWidth: 1,
    borderColor: '#b00020',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  declineButtonText: { color: '#b00020', fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  errorText: { color: '#b00020', marginBottom: 8 },
});
