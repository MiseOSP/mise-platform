import { supabase } from './supabase';

export type ChatMessage = {
  id: string;
  senderId: string;
  message: string | null;
  createdAt: string;
};

// Resolves the app-level users.id for the signed-in Supabase auth user. Messages store
// sender_id as this app user id (not the Supabase auth uid), matching every other table.
export async function resolveAppUserId(authId: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('No account found for this session.');
  return data.id;
}

// Finds the existing event-scoped conversation, or creates one on first use. RLS
// (can_access_event, migration 010) restricts this to management, the client who owns the
// event, and any chef who has accepted an assignment on it.
export async function getOrCreateEventConversation(organizationId: string, eventId: string): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert({ organization_id: organizationId, event_id: eventId })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return created.id;
}

export async function fetchMessages(conversationId: string): Promise<{ data: ChatMessage[]; error: string | null }> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, message, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      message: m.message,
      createdAt: m.created_at,
    })),
    error: null,
  };
}

export async function sendMessage(senderId: string, conversationId: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    message: trimmed,
  });

  if (error) throw error;
}

// Counts messages the given user has not yet read in an event's conversation.
// "Unread" means the message was sent by someone else and has no read_at.
// Returns 0 when there is no conversation for the event yet, or on error
// (the badge is a non-critical hint, so we fail quiet rather than throw).
export async function countUnreadForEvent(
  eventId: string,
  appUserId: string,
): Promise<number> {
  const { data: convo, error: convoErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (convoErr || !convo) return 0;

  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', convo.id)
    .is('read_at', null)
    .neq('sender_id', appUserId);
  if (error || count == null) return 0;
  return count;
}

// Marks every message in a conversation that was sent by someone else as read.
// Called when the user opens the thread. Requires an UPDATE RLS policy on
// messages (see migration 028); without it this is a no-op under RLS.
// Fails quiet: a failed mark-read should never block viewing the thread.
export async function markConversationRead(
  conversationId: string,
  appUserId: string,
): Promise<void> {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .is('read_at', null)
    .neq('sender_id', appUserId);
}
