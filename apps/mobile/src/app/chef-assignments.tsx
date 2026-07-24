// Chef assignment admin screen (Phase 4, spec Sections 22, 51, 90).
// Lets an operator pick an upcoming event, see which chefs are assigned,
// assign a chef from the organization's chef list, and remove an assignment.
// Read/write is RLS-scoped server-side (spec S51/S60 -- UI is not authorization).
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { EventListItem, fetchEventsForRole } from '@/lib/events';
import {
  EventAssignment,
  OrgChef,
  assignChefById,
  listAssignmentsForEvent,
  listChefsForOrg,
  removeAssignment,
} from '@/lib/assignments';

const STAFF_ROLES = new Set(['owner', 'admin', 'manager']);

function eventLabel(e: EventListItem): string {
  const when = e.event_date ?? 'No date';
  const what = e.occasion?.trim() || 'Event';
  const where = [e.city, e.state].filter(Boolean).join(', ');
  return where ? `${what} - ${when} - ${where}` : `${what} - ${when}`;
}

export default function ChefAssignmentsScreen() {
  const { role, organizationId } = useAuth();
  const isStaff = !!role && STAFF_ROLES.has(role);
  const hasOrg = !!organizationId;

  const [events, setEvents] = useState<EventListItem[]>([]);
  const [chefs, setChefs] = useState<OrgChef[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<EventAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBase = useCallback(async () => {
    if (!role || !organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: evs, error: evErr }, orgChefs] = await Promise.all([
        fetchEventsForRole(role, organizationId),
        listChefsForOrg(organizationId),
      ]);
      if (evErr) throw evErr;
      setEvents(evs ?? []);
      setChefs(orgChefs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load data.');
    } finally {
      setLoading(false);
    }
  }, [role, organizationId]);

  const loadAssignments = useCallback(async (eventId: string) => {
    try {
      const rows = await listAssignmentsForEvent(eventId);
      setAssignments(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load assignments.');
    }
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (selectedEventId) loadAssignments(selectedEventId);
    else setAssignments([]);
  }, [selectedEventId, loadAssignments]);

  const assignedChefIds = useMemo(
    () => new Set(assignments.map((a) => a.chefProfileId)),
    [assignments]
  );

  const onAssign = useCallback(
    async (chef: OrgChef) => {
      if (!selectedEventId) return;
      setBusy(true);
      try {
        await assignChefById(selectedEventId, chef.chefProfileId);
        await loadAssignments(selectedEventId);
      } catch (e) {
        Alert.alert('Could not assign', e instanceof Error ? e.message : 'Try again.');
      } finally {
        setBusy(false);
      }
    },
    [selectedEventId, loadAssignments]
  );

  const onRemove = useCallback(
    (a: EventAssignment) => {
      Alert.alert('Remove chef?', `Remove ${a.chefName} from this event?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!selectedEventId) return;
            setBusy(true);
            try {
              await removeAssignment(a.assignmentId);
              await loadAssignments(selectedEventId);
            } catch (e) {
              Alert.alert('Could not remove', e instanceof Error ? e.message : 'Try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [selectedEventId, loadAssignments]
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

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!selectedEvent ? (
        <>
          <Text style={styles.heading}>Pick an event</Text>
          <FlatList
            data={events}
            keyExtractor={(e) => e.id}
            ListEmptyComponent={<Text style={styles.muted}>No events yet.</Text>}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => setSelectedEventId(item.id)}>
                <Text style={styles.rowTitle}>{eventLabel(item)}</Text>
                <Text style={styles.rowMeta}>
                  {(item.status ?? 'unknown').replace(/_/g, ' ')}
                  {item.guest_count ? ` - ${item.guest_count} guests` : ''}
                </Text>
              </Pressable>
            )}
          />
        </>
      ) : (
        <>
          <Pressable onPress={() => setSelectedEventId(null)}>
            <Text style={styles.back}>{'< Back to events'}</Text>
          </Pressable>
          <Text style={styles.heading}>{eventLabel(selectedEvent)}</Text>

          <Text style={styles.section}>Assigned chefs</Text>
          {assignments.length === 0 ? (
            <Text style={styles.muted}>No chefs assigned yet.</Text>
          ) : (
            assignments.map((a) => (
              <View key={a.assignmentId} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{a.chefName}</Text>
                  <Text style={styles.rowMeta}>
                    {a.role.replace(/_/g, ' ')} - {a.status}
                  </Text>
                </View>
                <Pressable disabled={busy} onPress={() => onRemove(a)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            ))
          )}

          <Text style={styles.section}>Available chefs</Text>
          {chefs.length === 0 ? (
            <Text style={styles.muted}>No chefs in this organization yet.</Text>
          ) : (
            chefs.map((c) => {
              const already = assignedChefIds.has(c.chefProfileId);
              return (
                <View key={c.chefProfileId} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{c.fullName}</Text>
                    <Text style={styles.rowMeta}>
                      {c.status}
                      {c.servsafeVerified ? ' - ServSafe' : ''}
                      {c.insuranceVerified ? ' - Insured' : ''}
                    </Text>
                  </View>
                  <Pressable
                    disabled={busy || already}
                    onPress={() => onAssign(c)}
                  >
                    <Text style={already ? styles.assignedTag : styles.assign}>
                      {already ? 'Assigned' : 'Assign'}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  section: { fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  back: { color: '#2563eb', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d5db',
  },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  assign: { color: '#2563eb', fontWeight: '600' },
  assignedTag: { color: '#9ca3af' },
  remove: { color: '#dc2626' },
  muted: { color: '#6b7280' },
  error: { color: '#dc2626', marginBottom: 12 },
});
