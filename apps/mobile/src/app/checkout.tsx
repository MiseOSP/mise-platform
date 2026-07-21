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

import { createDepositIntent } from '@/lib/payments';
import { formatMoney } from '@/lib/financials';
import { Brand } from '@/constants/theme';

// Deposit checkout / proposal acceptance (v2.0 Sections 35, 37, 48, 66).
//
// Flow: this screen calls the create-deposit-intent Edge Function, which reads
// the SERVER-AUTHORITATIVE deposit amount and returns a Stripe PaymentIntent
// client secret. The client NEVER states the amount (v2.0 Sections 51, 98).
//
// The actual card entry + confirmation is handled by the Stripe SDK. To keep
// this build honest, the card UI is behind a capability check: if the Stripe
// React Native SDK is not yet installed/registered, we surface a clear
// "secure payment" placeholder rather than pretending a charge occurred. The
// server-authoritative amount and client secret are fully wired; only the
// card-field component is the remaining integration (see PR notes).

type Phase = 'loading' | 'error' | 'ready' | 'paying' | 'done';

// Detects whether the native Stripe SDK has been linked. We avoid a static
// import so the screen still renders (and the flow is testable) before the
// dependency is added to the app.
function stripeSdkAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('@stripe/stripe-react-native');
    return true;
  } catch {
    return false;
  }
}

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const eventId = typeof params.eventId === 'string' ? params.eventId : undefined;

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const sdkReady = stripeSdkAvailable();

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

  const onConfirmPayment = useCallback(async () => {
    if (!clientSecret) return;
    setPhase('paying');
    setError(null);
    try {
      // The Stripe SDK confirms the PaymentIntent with the clientSecret. The
      // webhook (stripe-webhook) marks the payment paid; we then route to the
      // confirmation screen. Wiring the SDK's confirmPayment/PaymentSheet here
      // is the final integration step.
      const stripe = require('@stripe/stripe-react-native');
      if (!stripe?.confirmPayment) {
        throw new Error('Payment is not available yet.');
      }
      const result = await stripe.confirmPayment(clientSecret, { paymentMethodType: 'Card' });
      if (result?.error) {
        throw new Error(result.error.message ?? 'Payment could not be completed.');
      }
      setPhase('done');
      router.replace({ pathname: '/confirmation', params: { eventId: eventId! } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not be completed.');
      setPhase('ready');
    }
  }, [clientSecret, eventId, router]);

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

      {(phase === 'ready' || phase === 'paying') && amountCents !== null && (
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

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          {sdkReady ? (
            <PrimaryButton
              label={phase === 'paying' ? 'Processing...' : `Pay ${formatMoney(amountCents)} deposit`}
              onPress={onConfirmPayment}
              disabled={phase === 'paying'}
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

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
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
  primaryButton: {
    backgroundColor: Brand.denim,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 16,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: Brand.cream, fontSize: 16, fontWeight: '700', textAlign: 'center' },
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
