import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';

import { DashboardSummary } from '@/components/dashboard-summary';
import { EventRow } from '@/components/event-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { OrgRole } from '@/contexts/auth-context';
import { respondToAssignment } from '@/lib/assignments';
import { fetchEventsForRole, type EventListItem } from '@/lib/events';

export function ChefPortalScreen({
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

  const isChef = role === 'chef';

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

  const handleRespondToAssignment = useCallback(
    async (assignmentId: string, accept: boolean): Promise<string | null> => {
      try {
        await respondToAssignment(assignmentId, accept);
        await loadEvents();
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Could not update assignment.';
      }
    },
    [loadEvents],
  );

  const handleAssignChef = useCallback(async (): Promise<string | null> => null, []);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{organizationName ?? 'Your organization'}</ThemedText>
      <ThemedText>Signed in as {role ?? 'member'}.</ThemedText>

      <DashboardSummary isManagement={false} isChef={isChef} events={events} teamSize={null} />

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
              isChef={isChef}
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
