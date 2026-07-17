import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { createOrganizationForCurrentUser } from '@/lib/organizations';
import { fetchEventsForRole, type EventListItem } from '@/lib/events';

// Sprint 1/2: Home tab branches on auth + membership state:
//   1. no session            -> point the user at the Account tab to sign in
//   2. session, no org yet   -> onboarding: create an organization (owner)
//   3. session + org         -> role-appropriate events list
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
  eventRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
    gap: 2,
  },
});
