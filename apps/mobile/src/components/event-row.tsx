import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { EventListItem } from '@/lib/events';
import {
  getOrCreateEventConversation,
  fetchMessages,
  sendMessage,
  resolveAppUserId,
  type ChatMessage,
} from '@/lib/messaging';

export function EventRow({
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
        {item.occasion ?? 'Event'} — {item.guest_count ?? '?'} guests — {item.status}
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
            style={[styles.button, responding && styles.buttonDisabled]}
          >
            {responding ? 'Saving...' : 'Accept'}
          </ThemedText>
          <ThemedText
            onPress={responding ? undefined : () => handleRespondPress(false)}
            style={[styles.button, responding && styles.buttonDisabled]}
          >
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
            style={[styles.button, assignSubmitting && styles.buttonDisabled]}
          >
            {assignSubmitting ? 'Assigning...' : 'Confirm assignment'}
          </ThemedText>
          <ThemedText
            onPress={() => {
              setAssigning(false);
              setRowStatus(null);
            }}
          >
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
            style={[styles.button, sendingMessage && styles.buttonDisabled]}
          >
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

const styles = StyleSheet.create({
  eventRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
    gap: 2,
  },
  form: {
    gap: 8,
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
});
