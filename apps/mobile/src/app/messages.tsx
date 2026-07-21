import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  fetchMessages,
  getOrCreateEventConversation,
  resolveAppUserId,
  sendMessage,
  type ChatMessage,
} from '@/lib/messaging';
import { useAuth } from '@/contexts/auth-context';
import { Brand } from '@/constants/theme';

// Event messaging thread (v2.0 Sections 26, 38, 88).
//
// In-app messaging is the MVP communication channel; SMS relay is deferred
// (Section 26). Conversations are scoped to a single Event. RLS (migration
// 010) enforces who can read/write, so this screen only wires the UI to the
// already-built messaging lib. The signed-in user's app-level id is resolved
// once and used as the sender for every message (Section 26).
// Renders a compact local time like "3:04 PM" for a message's ISO createdAt.
// Falls back to an empty string if the value is missing or unparseable.
function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function MessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const eventId = typeof params.eventId === 'string' ? params.eventId : undefined;
  const { organizationId, session, loading: authLoading } = useAuth();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!eventId) {
      setError('We could not find this conversation. Please open it from your event.');
      setPhase('error');
      return;
    }
    if (!session?.user?.id || !organizationId) {
      setError('Please sign in to view your messages.');
      setPhase('error');
      return;
    }

    setPhase('loading');
    setError(null);
    try {
      const uid = await resolveAppUserId(session.user.id);
      const convId = await getOrCreateEventConversation(organizationId, eventId);
      const { data, error: fetchErr } = await fetchMessages(convId);
      if (fetchErr) throw new Error(fetchErr);
      setAppUserId(uid);
      setConversationId(convId);
      setMessages(data);
      setPhase('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not load your messages.');
      setPhase('error');
    }
  }, [authLoading, eventId, organizationId, session]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !conversationId || !appUserId || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(appUserId, conversationId, text);
      setDraft('');
      const { data, error: fetchErr } = await fetchMessages(conversationId);
      if (fetchErr) throw new Error(fetchErr);
      setMessages(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your message could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  }, [draft, conversationId, appUserId, sending]);

  if (phase === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Brand.denim} />
        <Text style={styles.muted}>Loading your conversation…</Text>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.error}>{error}</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>NASHVILLE CHEF SERVICE</Text>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.muted}>We usually reply within a few hours.</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.denim} />}
      >
        {messages.length === 0 ? (
          <Text style={styles.empty}>
            No messages yet. Send a note and our team will be in touch.
          </Text>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === appUserId;
            return (
              <View
                key={m.id}
                style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
              >
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
                    {m.message}
                  </Text>
                    <Text style={mine ? styles.timestampMine : styles.timestampTheirs}>
                      {formatTime(m.createdAt)}
                    </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {error ? <Text style={styles.inlineError}>{error}</Text> : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message…"
          placeholderTextColor={Brand.textMuted}
          multiline
          accessibilityLabel="Message text"
          editable={!sending}
        />
        <Pressable
          onPress={onSend}
          accessibilityRole="button"
          disabled={sending || draft.trim().length === 0}
          style={[styles.sendButton, (sending || draft.trim().length === 0) && styles.sendButtonDisabled]}
        >
          {sending ? (
            <ActivityIndicator color={Brand.cream} />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.cream },
  centered: {
    flex: 1,
    backgroundColor: Brand.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
    gap: 4,
  },
  eyebrow: { color: Brand.clay, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', fontSize: 12 },
  title: { fontSize: 28, fontWeight: '700', color: Brand.espresso },
  muted: { fontSize: 13, lineHeight: 20, color: Brand.textMuted },
  error: { color: Brand.clay, fontSize: 14, textAlign: 'center' },
  inlineError: { color: Brand.clay, fontSize: 13, paddingHorizontal: 20, paddingBottom: 4 },
  thread: { flex: 1 },
  threadContent: { padding: 20, gap: 10 },
  empty: { color: Brand.textMuted, fontSize: 14, textAlign: 'center', marginTop: 32 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleMine: { backgroundColor: Brand.denim, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: Brand.surface, borderWidth: 1, borderColor: Brand.border, borderBottomLeftRadius: 4 },
  bubbleTextMine: { color: Brand.cream, fontSize: 15, lineHeight: 21 },
  bubbleTextTheirs: { color: Brand.espresso, fontSize: 15, lineHeight: 21 },
  timestampMine: { color: Brand.cream, fontSize: 11, marginTop: 4, opacity: 0.7, alignSelf: 'flex-end' },
  timestampTheirs: { color: Brand.textMuted, fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Brand.espresso,
    backgroundColor: Brand.cream,
  },
  sendButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.denim,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: Brand.cream, fontSize: 16, fontWeight: '700' },
  secondaryButton: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 8 },
  secondaryButtonText: { color: Brand.denim, fontWeight: '600' },
});
