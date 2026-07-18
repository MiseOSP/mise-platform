import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';

import { DashboardSummary } from '@/components/dashboard-summary';
import { EventRow } from '@/components/event-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { OrgRole } from '@/contexts/auth-context';
import { fetchEventsForRole, type EventListItem } from '@/lib/events';

// Clients previously fell through to ChefPortalScreen, which shows
// chef-only assignment accept/decline controls and mislabels the sign-in
// role. The underlying event query already scopes correctly for clients
// via RLS (see fetchEventsForRole in lib/events.ts) -- this screen just
// gives them their own, correctly-labelled, read-only view: their events,
// the event chat, the selected menu, and their payment status (each
// already gated to client-appropriate visibility inside EventRow).
export function ClientPortalScreen({
  organizationId,
  organizationName,
  role,
  authId,
}: {
  organizationId: string;
  organizationName: string | null;
  role: OrgRole;
  authId: string;
}) {
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

  const handleAssignChef = useCallback(async (): Promise<string | null> => null, []);
  const handleRespondToAssignment = useCallback(async (): Promise<string | null> => null, []);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{organizationName ?? 'Your events'}</ThemedText>
      <ThemedText>Signed in as client.</ThemedText>
      <DashboardSummary isManagement={false} isChef={false} events={events} teamSize={null} />

      {eventsLoading ? (
        <ActivityIndicator />
      ) : eventsError ? (
        <ThemedText style={styles.error}>{eventsError}</ThemedText>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventRow
              item={item}
              isChef={false}
              isManagement={false}
              onAssign={handleAssignChef}
              onRespond={handleRespondToAssignment}
              organizationId={organizationId ?? ''}
              authId={authId}
            />
          )}
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
  error: {
    color: '#d33',
  },
});
