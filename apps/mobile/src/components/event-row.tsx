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
import {
  fetchEventMenuItems,
  addEventMenuItem,
  removeEventMenuItem,
  type EventMenuItem,
} from '@/lib/event-menu';
import { fetchExperiences, fetchMenuCategories, fetchMenuItems } from '@/lib/experiences';
import { fetchEventPayments, fetchEventPayouts, type EventPayment, type EventPayout } from '@/lib/payments';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [eventMenuItems, setEventMenuItems] = useState<EventMenuItem[]>([]);
  const [catalogItems, setCatalogItems] = useState<{ id: string; label: string }[]>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string | null>(null);
  const [newQuantity, setNewQuantity] = useState('1');
  const [newPriceAdjustment, setNewPriceAdjustment] = useState('0');
  const [savingMenuItem, setSavingMenuItem] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [eventPayments, setEventPayments] = useState<EventPayment[]>([]);
  const [eventPayouts, setEventPayouts] = useState<EventPayout[]>([]);

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

  const handleOpenMenu = async () => {
    setMenuOpen(true);
    setMenuError(null);
    setMenuLoading(true);
    try {
      const result = await fetchEventMenuItems(item.id);
      setEventMenuItems(result.data);
      setMenuError(result.error);
      if (isManagement) {
        const exps = await fetchExperiences(organizationId);
        const flat: { id: string; label: string }[] = [];
        for (const exp of exps) {
          if (!exp.active) continue;
          const cats = await fetchMenuCategories(exp.id);
          for (const cat of cats) {
            const catalogEntries = await fetchMenuItems(cat.id);
            for (const mi of catalogEntries) {
              if (mi.active) flat.push({ id: mi.id, label: `${exp.name} - ${cat.name} - ${mi.name}` });
            }
          }
        }
        setCatalogItems(flat);
      }
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : 'Could not load menu.');
    } finally {
      setMenuLoading(false);
    }
  };

  const handleAddMenuItem = async () => {
    if (!selectedMenuItemId) {
      setMenuError('Choose an item to add.');
      return;
    }
    setSavingMenuItem(true);
    try {
      await addEventMenuItem({
        eventId: item.id,
        menuItemId: selectedMenuItemId,
        quantity: Number(newQuantity) || 1,
        priceAdjustment: Number(newPriceAdjustment) || 0,
      });
      setSelectedMenuItemId(null);
      setNewQuantity('1');
      setNewPriceAdjustment('0');
      const result = await fetchEventMenuItems(item.id);
      setEventMenuItems(result.data);
      setMenuError(result.error);
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : 'Could not add menu item.');
    } finally {
      setSavingMenuItem(false);
    }
  };

  const handleOpenPayments = async () => {
    setPaymentsOpen(true);
    setPaymentsError(null);
    setPaymentsLoading(true);
    try {
      const [paymentsResult, payoutsResult] = await Promise.all([
        fetchEventPayments(item.id),
        fetchEventPayouts(item.id),
      ]);
      setEventPayments(paymentsResult.data);
      setEventPayouts(payoutsResult.data);
      setPaymentsError(paymentsResult.error ?? payoutsResult.error);
    } catch (e) {
      setPaymentsError(e instanceof Error ? e.message : 'Could not load payment status.');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleRemoveMenuItem = async (id: string) => {
    try {
      await removeEventMenuItem(id);
      const result = await fetchEventMenuItems(item.id);
      setEventMenuItems(result.data);
      setMenuError(result.error);
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : 'Could not remove menu item.');
    }
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
      {isManagement && (item.chefFee != null || item.foodCostEstimate != null) ? (
        <ThemedText style={styles.financials}>
          {item.chefFee != null ? `Chef fee: $${item.chefFee.toFixed(2)}` : 'Chef fee: —'}
          {'  ·  '}
          {item.foodCostEstimate != null ? `Food cost est: $${item.foodCostEstimate.toFixed(2)}` : 'Food cost est: —'}
        </ThemedText>
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
      {!menuOpen ? (
        <ThemedText onPress={handleOpenMenu} style={styles.button}>
          Menu
        </ThemedText>
      ) : (
        <ThemedView style={styles.form}>
          <ThemedText type="smallBold">Event menu</ThemedText>
          {menuLoading ? <ThemedText>Loading menu...</ThemedText> : null}
          {eventMenuItems.map((mi) => (
            <ThemedText key={mi.id}>
              {mi.name} x{mi.quantity}
              {mi.priceAdjustment ? ` (+$${mi.priceAdjustment.toFixed(2)})` : ''}
              {isManagement ? (
                <ThemedText onPress={() => handleRemoveMenuItem(mi.id)} style={styles.error}>
                  {'  Remove'}
                </ThemedText>
              ) : null}
            </ThemedText>
          ))}
          {!menuLoading && eventMenuItems.length === 0 ? <ThemedText>No menu items yet.</ThemedText> : null}
          {isManagement ? (
            <ThemedView style={styles.form}>
              <ThemedText type="smallBold">Add item</ThemedText>
              {catalogItems.map((ci) => (
                <ThemedText key={ci.id} onPress={() => setSelectedMenuItemId(ci.id)} style={styles.button}>
                  {selectedMenuItemId === ci.id ? `\u2713 ${ci.label}` : ci.label}
                </ThemedText>
              ))}
              <TextInput
                style={styles.input}
                placeholder="Quantity"
                value={newQuantity}
                onChangeText={setNewQuantity}
                keyboardType="numeric"
                editable={!savingMenuItem}
              />
              <TextInput
                style={styles.input}
                placeholder="Price adjustment (optional)"
                value={newPriceAdjustment}
                onChangeText={setNewPriceAdjustment}
                keyboardType="numeric"
                editable={!savingMenuItem}
              />
              <ThemedText
                onPress={savingMenuItem ? undefined : handleAddMenuItem}
                style={[styles.button, savingMenuItem && styles.buttonDisabled]}
              >
                {savingMenuItem ? 'Adding...' : 'Add to event'}
              </ThemedText>
            </ThemedView>
          ) : null}
          <ThemedText onPress={() => setMenuOpen(false)}>Close</ThemedText>
          {menuError ? <ThemedText style={styles.error}>{menuError}</ThemedText> : null}
        </ThemedView>
      )}
      {!paymentsOpen ? (
        <ThemedText onPress={handleOpenPayments} style={styles.button}>
          Payments
        </ThemedText>
      ) : (
        <ThemedView style={styles.form}>
          <ThemedText type="smallBold">Payment status</ThemedText>
          {paymentsLoading ? <ThemedText>Loading payment status...</ThemedText> : null}
          {eventPayments.map((p) => (
            <ThemedText key={p.id}>
              {'Payment: $' + p.amount.toFixed(2) + ' (' + p.paymentType + ') - ' + p.status}
            </ThemedText>
          ))}
          {!paymentsLoading && eventPayments.length === 0 ? (
            <ThemedText>No payment records visible.</ThemedText>
          ) : null}
          {eventPayouts.map((po) => (
            <ThemedText key={po.id}>
              {'Payout: $' + po.amount.toFixed(2) + ' - ' + po.status}
            </ThemedText>
          ))}
          {!paymentsLoading && eventPayouts.length === 0 ? (
            <ThemedText>No payout records visible.</ThemedText>
          ) : null}
          <ThemedText onPress={() => setPaymentsOpen(false)}>Close</ThemedText>
          {paymentsError ? <ThemedText style={styles.error}>{paymentsError}</ThemedText> : null}
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
  financials: { color: '#666', fontSize: 12 },
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
