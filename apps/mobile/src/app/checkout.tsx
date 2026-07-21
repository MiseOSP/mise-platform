import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import DepositCardForm from '@/components/deposit-card-form';
import { createDepositIntent } from '@/lib/payments';
import { formatMoney } from '@/lib/financials';
import { isStripeReady } from '@/lib/stripe';
import { Brand } from '@/constants/theme';

// Deposit checkout / proposal acceptance (v2.0 Sections 35, 37, 48, 66).
//
// Flow: this screen calls the create-deposit-intent Edge Function, which reads
// the SERVER-AUTHORITATIVE deposit amount and returns a Stripe PaymentIntent
// client secret. The client NEVER states the amount (v2.0 Sections 51, 98).
//
// Card collection + PaymentIntent confirmation are delegated to DepositCardForm,
// which has a native implementation (Stripe CardField + confirmPayment) and a
// web stub. If Stripe cannot run on this device (web today, or before a native
// rebuild links the SDK) we surface a clear 'secure payment' notice instead of
// pretending a charge occurred -- the amount and client secret are still real.

type Phase = 'loading' | 'error' | 'ready';

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const eventId = typeof params.eventId === 'string' ? params.eventId : undefined;

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const sdkReady = isStripeReady();

  const start = useCallback(async () => {
    if (!eventId) {
      setError('We could not find this proposal. Please use the link we sent you.');
      setPhase('error');
      return;
    }
    setPhase('loading');
    setError(null);
    const { data, error: err } = await createDepositIntent(eventId);
    if (err || !data) {
      setError(err ?? 'We could not start your deposit just now.');
      setPhase('error');
      return;
    }
    setAmountCents(data.amountCents);
    setClientSecret(data.clientSecret);
    setPhase('ready');
  }, [eventId]);

  useEffect(() => {
    start();
  }, [start]);

  const onPaid = useCallback(() => {
    // The stripe-webhook marks the payment paid server-side; we route to the
    // confirmation screen, which reads the server summary.
    if (eventId) {
      router.replace({ pathname: '/confirmation', params: { eventId } });
    }
  }, [eventId, router]);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>Nashville Chef Service</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Secure your date
      </Text>
      <Text style={styles.body}>
        Your deposit confirms your booking. The rest is due after your experience.
      </Text>

      {phase === 'loading' && (
        <View style={styles.stateBlock} accessibilityLiveRegion="polite">
          <ActivityIndicator color={Brand.denim} />
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.stateBlock}>
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
          {eventId ? <SecondaryButton label="Try again" onPress={start} /> : null}
        </View>
      )}

      {phase === 'ready' && amountCents !== null && clientSecret && (
        <>
          <View style={styles.card}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Deposit due today</Text>
              <Text style={styles.amountValue}>{formatMoney(amountCents)}</Text>
            </View>
            <Text style={styles.muted}>
              This is 50% of your eligible service and add-on charges, confirmed by our team.
              Nothing else is charged today.
            </Text>
          </View>

          {sdkReady ? (
            <DepositCardForm
              clientSecret={clientSecret}
              amountLabel={formatMoney(amountCents)}
              onPaid={onPaid}
            />
          ) : (
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                Secure payment
              </Text>
              <Text style={styles.muted}>
                Card entry opens here once secure payment is enabled on this device. Your deposit
                amount is locked and confirmed by our team -- you will never be charged more than
                what is shown above.
              </Text>
            </View>
          )}

          <SecondaryButton label="Back to estimate" onPress={() => router.back()} />
        </>
      )}
    </ScrollView>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: Brand.cream,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    gap: 4,
  },
  eyebrow: {
    color: Brand.clay,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: { fontSize: 28, fontWeight: '700', color: Brand.espresso, marginTop: 6, marginBottom: 10 },
  body: { fontSize: 16, lineHeight: 24, color: Brand.espresso, marginBottom: 8 },
  muted: { fontSize: 13, lineHeight: 20, color: Brand.textMuted, marginTop: 8 },
  error: { color: Brand.clay, fontSize: 14, marginTop: 8 },
  stateBlock: { paddingVertical: 24, gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: 18,
    marginTop: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Brand.espresso, marginBottom: 8 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountLabel: { fontSize: 16, fontWeight: '700', color: Brand.espresso },
  amountValue: { fontSize: 22, fontWeight: '700', color: Brand.espresso, fontVariant: ['tabular-nums'] },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 8,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  secondaryButtonText: { color: Brand.denim, fontWeight: '600' },
});
