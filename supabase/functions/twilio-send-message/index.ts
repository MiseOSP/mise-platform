// Sends an SMS via Twilio and logs it to the `messages` table.
//
// SCAFFOLD ONLY -- not deployed or activated. Requires:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy with: supabase functions deploy twilio-send-message
// (default JWT verification stays ON -- only a signed-in org member may call this)
//
// Expects POST body:
//   { "conversationId": "<uuid>", "senderId": "<users.id>", "toPhone": "+1...", "message": "..." }
// NOTE: senderId is currently trusted from the request body. Before this
// goes live, derive it from the verified caller's JWT instead (same
// caller-scoped-client pattern as stripe-connect-onboarding) and confirm
// they're a participant of conversationId.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const authToken = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER') ?? '';
const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { conversationId, senderId, toPhone, message } = await req.json();
    if (!conversationId || !senderId || !toPhone || !message) {
      return new Response(
        JSON.stringify({ error: 'conversationId, senderId, toPhone, and message are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: toPhone, From: fromNumber, Body: message }),
      }
    );

    const twilioResult = await twilioResponse.json();
    if (!twilioResponse.ok) {
      console.error('Twilio send failed', twilioResult);
      return new Response(JSON.stringify({ error: 'Twilio send failed' }), { status: 502, headers: corsHeaders });
    }

    const { error: insertError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message,
      channel: 'sms',
      external_message_id: twilioResult.sid,
    });
    if (insertError) console.error('Failed to log message', insertError);

    return new Response(JSON.stringify({ sid: twilioResult.sid }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('twilio-send-message error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
