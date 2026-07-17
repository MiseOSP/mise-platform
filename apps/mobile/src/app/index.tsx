import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AuthScreen } from '@/components/auth-screen';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { createOrganizationForCurrentUser, fetchTeamSize } from '@/lib/organizations';
import { fetchEventsForRole, createEvent, type EventListItem } from '@/lib/events';
import { assignChefByEmail, respondToAssignment } from '@/lib/assignments';
import { fetchExperiences, type Experience } from '@/lib/experiences';
import {
  getOrCreateEventConversation,
  fetchMessages,
  sendMessage,
  resolveAppUserId,
  type ChatMessage,
} from '@/lib/messaging';

const MANAGEMENT_ROLES = new Set(['owner', 'admin', 'manager']);

function DashboardSummary({
  isManagement,
  isChef,
  events,
  teamSize,
}: {
  isManagement: boolean;
  isChef: boolean;
  events: EventListItem[];
  teamSize: number | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const upcomingCount = events.filter((e) => e.event_date && e.event_date >= today).length;
  const pendingResponseCount = events.filter((e) => e.assignment_status === 'pending').length;

  const stats: { label: string; value: string | number }[] = [
    { label: 'Upcoming events', value: upcomingCount },
  ];
  if (isChef) {
    stats.push({ label: 'Needs your response', value: pendingResponseCount });
  }
  if (isManagement) {
    stats.push({ label: 'Team members', value: teamSize ?? '\u2014' });
  }

  return (
    <ThemedView style={styles.summaryRow}>
      {stats.map((stat) => (
        <ThemedView key={stat.label} style={styles.summaryCard}>
          <ThemedText type="title" style={styles.summaryValue}>
            {stat.value}
          </ThemedText>
          <ThemedText style={styles.summaryLabel}>{stat.label}</ThemedText>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

function EventRow({
  item,
  isChef,
  isManagement,
  onAssign,
  onRespond,
  organizationId,
  authId,
}: {
  item: EventListItem;
  isChef: boolean;
  isManagement: boolean;
  onAssign: (eventId: string, chefEmail: string, role: string) => Promise<string | null>;
  onRespond: (assignmentId: string, accept: boolean) => Promise<string | null>;
  organizationId: string;
  authId: string;
}) {
  const [assigning, setAssigning] = useState(false);
  const [chefEmail, setChefEmail] = useState('');
  const [assignRole, setAssignRole] = useState('lead_chef');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [rowStatus, setRowStatus] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [myAppUserId, setMyAppUserId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const handleOpenChat = async () => {
    setChatOpen(true);
    setChatError(null);
    setChatLoading(true);
    try {
      const [userId, convoId] = await Promise.all([
        myAppUserId ? Promise.resolve(myAppUserId) : resolveAppUserId(authId),
        getOrCreateEventConversation(organizationId, item.id),
      ]);
      setMyAppUserId(userId);
      setConversationId(convoId);
      const result = await fetchMessages(convoId);
      setMessages(result.data);
      setChatError(result.error);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Could not load messages.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!conversationId || !myAppUserId || !draftText.trim()) return;
    setSendingMessage(true);
    try {
      await sendMessage(myAppUserId, conversationId, draftText.trim());
      setDraftText('');
      const result = await fetchMessages(conversationId);
      setMessages(result.data);
      setChatError(result.error);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Could not send message.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAssignPress = async () => {
    setRowStatus(null);
    if (!chefEmail.trim()) {
      setRowStatus("Enter the chef's email.");
      return;
    }
    setAssignSubmitting(true);
    const err = await onAssign(item.id, chefEmail.trim(), assignRole.trim());
    setAssignSubmitting(false);
    if (err) {
      setRowStatus(err);
    } else {
      setChefEmail('');
      setAssigning(false);
      setRowStatus('Chef assigned.');
    }
  };

  const handleRespondPress = async (accept: boolean) => {
    if (!item.assignmentId) return;
    setResponding(true);
    const err = await onRespond(item.assignmentId, accept);
    setResponding(false);
    if (err) setRowStatus(err);
  };

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
      {isChef && item.assignment_status === 'pending' && item.assignmentId ? (
        <ThemedView style={styles.form}>
          <ThemedText
            onPress={responding ? undefined : () => handleRespondPress(true)}
            style={[styles.button, responding && styles.buttonDisabled]}>
            {responding ? 'Saving...' : 'Accept'}
          </ThemedText>
          <ThemedText
            onPress={responding ? undefined : () => handleRespondPress(false)}
            style={[styles.button, responding && styles.buttonDisabled]}>
            Decline
          </ThemedText>
        </ThemedView>
      ) : null}
      {isManagement && !assigning ? (
        <ThemedText onPress={() => setAssigning(true)} style={styles.button}>
          Assign chef
        </ThemedText>
      ) : null}
      {isManagement && assigning ? (
        <ThemedView style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Chef's email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={chefEmail}
            onChangeText={setChefEmail}
            editable={!assignSubmitting}
          />
          <TextInput
            style={styles.input}
            placeholder="Role (default lead_chef)"
            value={assignRole}
            onChangeText={setAssignRole}
            editable={!assignSubmitting}
          />
          <ThemedText
            onPress={assignSubmitting ? undefined : handleAssignPress}
            style={[styles.button, assignSubmitting && styles.buttonDisabled]}>
            {assignSubmitting ? 'Assigning...' : 'Confirm assignment'}
          </ThemedText>
          <ThemedText
            onPress={() => {
              setAssigning(false);
              setRowStatus(null);
            }}>
            Cancel
          </ThemedText>
        </ThemedView>
      ) : null}
      {!chatOpen ? (
        <ThemedText onPress={handleOpenChat} style={styles.button}>
          Messages
        </ThemedText>
      ) : (
        <ThemedView style={styles.form}>
          <ThemedText type="smallBold">Messages</ThemedText>
          {chatLoading ? <ThemedText>Loading messages...</ThemedText> : null}
          {messages.map((m) => (
            <ThemedText key={m.id}>
              {m.senderId === myAppUserId ? 'You' : 'Them'}: {m.message}
            </ThemedText>
          ))}
          {!chatLoading && messages.length === 0 ? <ThemedText>No messages yet.</ThemedText> : null}
          <TextInput
            style={styles.input}
            placeholder="Type a message"
            value={draftText}
            onChangeText={setDraftText}
            editable={!sendingMessage}
          />
          <ThemedText
            onPress={sendingMessage ? undefined : handleSendMessage}
            style={[styles.button, sendingMessage && styles.buttonDisabled]}>
            {sendingMessage ? 'Sending...' : 'Send'}
          </ThemedText>
          <ThemedText onPress={() => setChatOpen(false)}>Close</ThemedText>
          {chatError ? <ThemedText style={styles.error}>{chatError}</ThemedText> : null}
        </ThemedView>
      )}
      {rowStatus ? <ThemedText style={styles.error}>{rowStatus}</ThemedText> : null}
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
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!organizationId) return;
    fetchExperiences(organizationId)
      .then(setExperiences)
      .catch(() => setExperiences([]));
  }, [organizationId]);

  const [teamSize, setTeamSize] = useState<number | null>(null);

  useEffect(() => {
    if (!organizationId || !isManagement) {
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
  }, [organizationId, isManagement]);

  const handleAssignChef = useCallback(
    async (eventId: string, chefEmail: string, role: string): Promise<string | null> => {
      if (!organizationId) return 'No organization selected.';
      try {
        await assignChefByEmail({ organizationId, eventId, chefEmail, role: role || undefined });
        await loadEvents();
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Could not assign chef.';
      }
    },
    [organizationId, loadEvents]
  );

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
    [loadEvents]
  );

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
      });
      setEventFormStatus('Event created.');
      setClientEmail('');
      setEventDate('');
      setOccasion('');
      setGuestCount('');
      setSelectedExperienceId(null);
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
    return <AuthScreen />;
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

      <DashboardSummary
        isManagement={isManagement}
        isChef={role === 'chef'}
        events={events}
        teamSize={teamSize}
      />

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
                        }}>
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
                isChef={role === 'chef'}
                isManagement={isManagement}
                onAssign={handleAssignChef}
                onRespond={handleRespondToAssignment}
                organizationId={organizationId ?? ''}
                authId={session.user.id}
              />
            )}
          ListEmptyComponent={<ThemedText>No events yet.</ThemedText>}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: 22,
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
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
