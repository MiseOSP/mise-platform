import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { EventListItem, fetchChefVisibleEvent } from '@/lib/events';
import { EventMenuItem, fetchEventMenuItems } from '@/lib/event-menu';
import { respondToAssignment } from '@/lib/assignments';

// Chef event-detail screen (Phase 5, spec S91 "Event detail" + "Menu and
// dietary visibility"). Everything shown here comes from chef-safe sources:
// the masked chef_visible_events view (address hidden until ~15h before, no
// internal notes -- migration 005) and event_menu_items, which RLS lets an
// assigned chef read (migration 011). Accept/decline reuses respondToAssignment
// (chef can only touch their own row -- migration 008). UI visibility is never
// authorization (spec S51/S60/S65).
//
// NOTE: dietary restrictions / allergies are NOT yet exposed to chefs through
// the chef_visible_events view. Surfacing them (spec S68 -- critical allergy
// info must be prominent in chef views) requires a server-side view/RLS change
// (a migration + product decision), so this screen shows a clear placeholder
// rather than silently widening a security-sensitive view.

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function EventDetailScreen() {
  const { role } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const eventId = typeof params.eventId === 'string' ? params.eventId : undefined;
  const isChef = role === 'chef';

  const [event, setEvent] = useState<EventListItem | null>(null);
  const [menu, setMenu] = useState<EventMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) {
      setError('No event selected.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [eventRes, menuRes] = await Promise.all([
        fetchChefVisibleEvent(eventId),
        fetchEventMenuItems(eventId),
      ]);
      if (eventRes.error) setError(eventRes.error);
      setEvent(eventRes.data);
      if (menuRes.error && !eventRes.error) setError(menuRes.error);
      setMenu(menuRes.data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (accept: boolean) => {
    if (!event?.assignmentId) return;
    setResponding(true);
    setError(null);
    try {
      await respondToAssignment(event.assignmentId, accept);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to send your response');
    } finally {
      setResponding(false);
    }
  };

  if (!isChef) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Event</Text>
        <Text style={styles.muted}>This detail view is for assigned chefs.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Event</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : <Text style={styles.muted}>Event not found.</Text>}
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const pending = event.assignment_status === 'pending';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.header}>{event.occasion || 'Event'}</Text>
      <Text style={styles.subheader}>{formatDate(event.event_date)}</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Details</Text>
        <Row label="Status" value={event.status} />
        <Row label="Your response" value={event.assignment_status || 'pending'} />
        <Row label="Time" value={event.start_time || 'To be confirmed'} />
        <Row label="Guests" value={event.guest_count != null ? String(event.guest_count) : 'To be confirmed'} />
        <Row
          label="Location"
          value={
            event.address
              ? [event.address, event.city, event.state].filter(Boolean).join(', ')
              : [event.city, event.state].filter(Boolean).join(', ') || 'Area shared closer to the event'
          }
        />
        {!event.address ? (
          <Text style={styles.hint}>The exact address unlocks about 15 hours before service.</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Menu</Text>
        {menu.length === 0 ? (
          <Text style={styles.muted}>No menu items have been added yet.</Text>
        ) : (
          menu.map((m) => (
            <View key={m.id} style={styles.menuRow}>
              <Text style={styles.menuName}>{m.name}</Text>
              <Text style={styles.menuQty}>{`x${m.quantity}`}</Text>
            </View>
          ))
        )}
      </View>

      <View style={[styles.card, styles.dietCard]}>
        <Text style={styles.cardTitle}>Dietary &amp; allergies</Text>
        {event.dietaryStatement ? (
          <Text style={styles.dietBody}>{event.dietaryStatement}</Text>
        ) : null}
        {event.dietaryPreferences ? (
          <Text style={[styles.dietBody, { marginTop: event.dietaryStatement ? 8 : 0 }]}>
            {event.dietaryPreferences}
          </Text>
        ) : null}
        {!event.dietaryStatement && !event.dietaryPreferences ? (
          <Text style={styles.muted}>
            No dietary or allergy notes are recorded for this event. Always confirm requirements with the
            office before shopping and service.
          </Text>
        ) : (
          <Text style={styles.dietHint}>
            Always reconfirm allergies directly with the office before service.
          </Text>
        )}
      </View>

      {pending && event.assignmentId ? (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.acceptButton, responding && styles.buttonDisabled]}
            disabled={responding}
            onPress={() => respond(true)}
          >
            <Text style={styles.acceptButtonText}>{responding ? '...' : 'Accept assignment'}</Text>
          </Pressable>
          <Pressable
            style={[styles.declineButton, responding && styles.buttonDisabled]}
            disabled={responding}
            onPress={() => respond(false)}
          >
            <Text style={styles.declineButtonText}>{responding ? '...' : 'Decline'}</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push({ pathname: '/messages', params: { eventId: event.id } })}
        style={styles.messageLink}
      >
        <Text style={styles.link}>Open event messages</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 22, fontWeight: '700' },
  subheader: { fontSize: 15, color: '#555', marginTop: 2, marginBottom: 12 },
  card: {
    backgroundColor: '#f7f7f7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  dietCard: { backgroundColor: '#fff4e5', borderWidth: 1, borderColor: '#f0c987' },
  dietBody: { color: '#5c4a1a', fontWeight: '600' },
  dietHint: { color: '#8a6100', marginTop: 8, fontSize: 13 },
  cardTitle: { fontWeight: '700', fontSize: 16, marginBottom: 8 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e2e2',
  },
  detailLabel: { color: '#777', fontWeight: '600' },
  detailValue: { color: '#222', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  hint: { color: '#8a6100', marginTop: 8, fontSize: 13 },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e2e2',
  },
  menuName: { color: '#222', flex: 1 },
  menuQty: { color: '#555', fontWeight: '600', marginLeft: 12 },
  muted: { color: '#777' },
  actionRow: { flexDirection: 'row', marginBottom: 14 },
  acceptButton: {
    backgroundColor: '#111',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginRight: 10,
  },
  acceptButtonText: { color: '#fff', fontWeight: '700' },
  declineButton: {
    borderWidth: 1,
    borderColor: '#b00020',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  declineButtonText: { color: '#b00020', fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  messageLink: { paddingVertical: 12 },
  backLink: { paddingVertical: 12 },
  link: { color: '#2a6df5', fontWeight: '600' },
  errorText: { color: '#b00020', marginBottom: 8 },
});
