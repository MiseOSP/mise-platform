import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { createOrganizationForCurrentUser } from '@/lib/organizations';
import { fetchEventsForRole, createEvent, type EventListItem } from '@/lib/events';

const MANAGEMENT_ROLES = new Set(['owner', 'admin', 'manager']);

function EventRow({ item, isChef }: { item: EventListItem; isChef: boolean }) {
  return (
    <ThemedView style={styles.eventRow}>
      <ThemedText type="smallBold">
        {item.event_date} {item.start_time ?? ''}
      </ThemedText>
      <ThemedText>
        {item.occasion ?? 'Event'} - {item.guest_count ?? '?'} guests - {item.status}
      </ThemedText>
      <ThemedText>
        {item.address ? item.address : isChef ? 'Address available 15h before event' : ''}
        {item.city ? `${item.address ? ', ' : ''}${item.city}, ${item.state ?? ''}` : ''}
      </ThemedText>
      {isChef && item.assignment_status ? (
        <ThemedText>Your assignment: {item.assignment_status}</ThemedText>
      ) : null}
    </ThemedView>
  );
}

export default function HomeScreen() {
  const { session, loading, role, organizationId, organizationName, refreshMembership } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [events, setEvents] = useState<EventListItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [showNewEvent, setShowNewEvent] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [occasion, setOccasion] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventFormStatus, setEventFormStatus] = useState<string | null>(null);

  const isManagement = !!role && MANAGEMENT_ROLES.has(role);

  const loadEvents = useCallback(async () => {
    if (!organizationId) return;
    setEventsLoading(true);
    const { data, error: fetchError } = await fetchEventsForRole(role, organizationId);
    setEvents(data);
    setEventsError(fetchError);
    setEventsLoading(false);
  }, [role, organizationId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  async function handleCreateEvent() {
    setEventFormStatus(null);
    if (!organizationId) return;
    if (!clientEmail.trim() || !eventDate.trim()) {
      setEventFormStatus('Client email and event date (YYYY-MM-DD) are required.');
      return;
    }
    setEventSubmitting(true);
    try {
      await createEvent({
        organizationId,
        clientEmail,
        eventDate: eventDate.trim(),
        occasion: occasion.trim() || undefined,
        guestCount: guestCount.trim() ? Number(guestCount.trim()) : undefined,
      });
      setEventFormStatus('Event created.');
      setClientEmail('');
      setEventDate('');
      setOccasion('');
      setGuestCount('');
      await loadEvents();
    } catch (e) {
      setEventFormStatus(e instanceof Error ? e.message : 'Could not create event.');
    } finally {
      setEventSubmitting(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator />
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Welcome to Mise</ThemedText>
        <ThemedText>Sign in from the Account tab to get started.</ThemedText>
      </ThemedView>
    );
  }

  if (!organizationId) {
    const handleCreate = async () => {
      setError(null);
      if (orgName.trim().length < 2) {
        setError('Enter a name with at least 2 characters.');
        return;
      }
      setSubmitting(true);
      try {
        await createOrganizationForCurrentUser({
          authId: session.user.id,
          email: session.user.email ?? null,
          organizationName: orgName,
        });
        await refreshMembership();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create organization.');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Create your organization</ThemedText>
        <ThemedText>
          You&apos;re signed in, but not yet part of an organization. Create one to continue --
          you&apos;ll be its owner.
        </ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Organization name"
          value={orgName}
          onChangeText={setOrgName}
          editable={!submitting}
        />
        <ThemedText
          onPress={submitting ? undefined : handleCreate}
          style={[styles.button, submitting && styles.buttonDisabled]}>
          {submitting ? 'Creating...' : 'Create organization'}
        </ThemedText>
        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{organizationName ?? 'Your organization'}</ThemedText>
      <ThemedText>Signed in as {role ?? 'member'}.</ThemedText>

      {isManagement ? (
        <ThemedView style={styles.form}>
          <ThemedText
            onPress={() => setShowNewEvent((v) => !v)}
            style={styles.button}>
            {showNewEvent ? 'Cancel' : '+ New event'}
          </ThemedText>
          {showNewEvent ? (
            <ThemedView style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Client email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={clientEmail}
                onChangeText={setClientEmail}
                editable={!eventSubmitting}
              />
              <TextInput
                style={styles.input}
                placeholder="Event date (YYYY-MM-DD)"
                value={eventDate}
                onChangeText={setEventDate}
                editable={!eventSubmitting}
              />
              <TextInput
                style={styles.input}
                placeholder="Occasion (optional)"
                value={occasion}
                onChangeText={setOccasion}
                editable={!eventSubmitting}
              />
              <TextInput
                style={styles.input}
                placeholder="Guest count (optional)"
                keyboardType="number-pad"
                value={guestCount}
                onChangeText={setGuestCount}
                editable={!eventSubmitting}
              />
              <ThemedText onPress={eventSubmitting ? undefined : handleCreateEvent} style={styles.button}>
                {eventSubmitting ? 'Creating...' : 'Create event'}
              </ThemedText>
              {eventFormStatus ? <ThemedText>{eventFormStatus}</ThemedText> : null}
            </ThemedView>
          ) : null}
        </ThemedView>
      ) : null}

      {eventsLoading ? (
        <ActivityIndicator />
      ) : eventsError ? (
        <ThemedText style={styles.error}>{eventsError}</ThemedText>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EventRow item={item} isChef={role === 'chef'} />}
          ListEmptyComponent={<ThemedText>No events yet.</ThemedText>}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: 12,
    padding: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
  button: {
    textAlign: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  error: {
    color: '#d33',
  },
  form: {
    gap: 8,
  },
  eventRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
    gap: 2,
  },
});
