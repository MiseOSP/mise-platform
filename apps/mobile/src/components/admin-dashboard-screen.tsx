import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';

import { DashboardSummary } from '@/components/dashboard-summary';
import { EventRow } from '@/components/event-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { OrgRole } from '@/contexts/auth-context';
import { assignChefByEmail } from '@/lib/assignments';
import { createEvent, fetchEventsForRole, type EventListItem } from '@/lib/events';
import { fetchExperiences, type Experience } from '@/lib/experiences';
import { fetchTeamSize } from '@/lib/organizations';
import { fetchAuditLogs, type AuditLogEntry } from '@/lib/audit-log';

export function AdminDashboardScreen({
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

  const [showNewEvent, setShowNewEvent] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [occasion, setOccasion] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [chefFee, setChefFee] = useState('');
  const [foodCostEstimate, setFoodCostEstimate] = useState('');
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventFormStatus, setEventFormStatus] = useState<string | null>(null);

  const [teamSize, setTeamSize] = useState<number | null>(null);

  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!organizationId) return;
    fetchExperiences(organizationId)
      .then(setExperiences)
      .catch(() => setExperiences([]));
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      setTeamSize(null);
      return;
    }
    let cancelled = false;
    fetchTeamSize(organizationId).then((result) => {
      if (!cancelled) setTeamSize(result.error ? null : result.count);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const handleAssignChef = useCallback(
    async (eventId: string, chefEmail: string, assignRole: string): Promise<string | null> => {
      if (!organizationId) return 'No organization selected.';
      try {
        await assignChefByEmail({ organizationId, eventId, chefEmail, role: assignRole || undefined });
        await loadEvents();
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Could not assign chef.';
      }
    },
    [organizationId, loadEvents],
  );

  const handleToggleAuditLog = useCallback(async () => {
    if (showAuditLog) {
      setShowAuditLog(false);
      return;
    }
    setShowAuditLog(true);
    if (!organizationId) return;
    setAuditLogsLoading(true);
    const { data, error } = await fetchAuditLogs(organizationId);
    setAuditLogs(data);
    setAuditLogsError(error);
    setAuditLogsLoading(false);
  }, [showAuditLog, organizationId]);

  const handleRespondToAssignment = useCallback(async (): Promise<string | null> => null, []);

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
        experienceId: selectedExperienceId ?? undefined,
        chefFee: chefFee.trim() ? Number(chefFee.trim()) : undefined,
        foodCostEstimate: foodCostEstimate.trim() ? Number(foodCostEstimate.trim()) : undefined,
      });
      setEventFormStatus('Event created.');
      setClientEmail('');
      setEventDate('');
      setOccasion('');
      setGuestCount('');
      setSelectedExperienceId(null);
      setChefFee('');
      setFoodCostEstimate('');
      await loadEvents();
    } catch (e) {
      setEventFormStatus(e instanceof Error ? e.message : 'Could not create event.');
    } finally {
      setEventSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{organizationName ?? 'Your organization'}</ThemedText>
      <ThemedText>Signed in as {role ?? 'member'}.</ThemedText>

      <DashboardSummary isManagement isChef={false} events={events} teamSize={teamSize} />

      <ThemedText onPress={() => setShowNewEvent((v) => !v)} style={styles.button}>
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
                    <TextInput
            style={styles.input}
            placeholder="Chef fee $ (optional)"
            keyboardType="decimal-pad"
            value={chefFee}
            onChangeText={setChefFee}
            editable={!eventSubmitting}
          />
          <TextInput
            style={styles.input}
            placeholder="Food cost estimate $ (optional)"
            keyboardType="decimal-pad"
            value={foodCostEstimate}
            onChangeText={setFoodCostEstimate}
            editable={!eventSubmitting}
          />
          {experiences.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {experiences.map((exp) => {
                const selected = selectedExperienceId === exp.id;
                return (
                  <ThemedText
                    key={exp.id}
                    onPress={() =>
                      setSelectedExperienceId(selected ? null : exp.id)
                    }
                    style={{
                      borderWidth: 1,
                      borderColor: selected ? '#222' : '#ccc',
                      backgroundColor: selected ? '#222' : 'transparent',
                      color: selected ? '#fff' : '#333',
                      borderRadius: 14,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      fontSize: 12,
                    }}
                  >
                    {exp.name}
                  </ThemedText>
                );
              })}
            </View>
          )}
          <ThemedText onPress={eventSubmitting ? undefined : handleCreateEvent} style={styles.button}>
            {eventSubmitting ? 'Creating...' : 'Create event'}
          </ThemedText>
          {eventFormStatus ? <ThemedText>{eventFormStatus}</ThemedText> : null}
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
          renderItem={({ item }) => (
            <EventRow
              item={item}
              isChef={false}
              isManagement
              onAssign={handleAssignChef}
              onRespond={handleRespondToAssignment}
              organizationId={organizationId ?? ''}
              authId={authId}
            />
          )}
          ListEmptyComponent={<ThemedText>No events yet.</ThemedText>}
        />
      )}

      <ThemedText onPress={handleToggleAuditLog} style={styles.button}>
        {showAuditLog ? 'Hide activity log' : 'Activity log'}
      </ThemedText>
      {showAuditLog ? (
        <ThemedView style={styles.form}>
          {auditLogsLoading ? <ActivityIndicator /> : null}
          {auditLogsError ? <ThemedText style={styles.error}>{auditLogsError}</ThemedText> : null}
          {!auditLogsLoading && !auditLogsError && auditLogs.length === 0 ? (
            <ThemedText>No activity recorded yet.</ThemedText>
          ) : null}
          {auditLogs.map((entry) => (
            <ThemedText key={entry.id}>
              {entry.createdAt} - {entry.action} on {entry.tableName}
            </ThemedText>
          ))}
          <ThemedText onPress={() => setShowAuditLog(false)}>Close</ThemedText>
        </ThemedView>
      ) : null}
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
});
