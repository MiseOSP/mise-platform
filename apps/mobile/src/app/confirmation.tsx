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

import {
  fetchEventFinancialSummary,
  formatMoney,
  type EventFinancialSummary,
} from '@/lib/financials';
import { Brand } from '@/constants/theme';

// Booking confirmation (v2.0 Section 37).
//
// Shown after the deposit is taken. Tone is warm, direct, organized, and
// confident. Amounts (paid + estimated remaining) come from the
// server-authoritative event_financial_summary; the client never computes
// them (v2.0 Sections 51, 98). Event logistics (date, address, menu) will be
// layered in once a single-event read exists; for now we confirm the money
// and next steps, which is what the client most needs to see immediately.

export default function ConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const eventId = typeof params.eventId === 'string' ? params.eventId : undefined;

  const [summary, setSummary] = useState<EventFinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchEventFinancialSummary(eventId);
    if (err) setError(err);
    setSummary(data);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const paid = summary?.paidCents ?? 0;
  const remaining = summary ? Math.max(summary.balanceCents, 0) : 0;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>Nashville Chef Service</Text>
      <Text accessibilityRole="header" style={styles.title}>
        You are booked
      </Text>
      <Text style={styles.body}>
        Thank you -- your deposit is in and your date is reserved. Our team will be in touch
        shortly to finalize the details of your experience.
      </Text>

      {loading && (
        <View style={styles.stateBlock} accessibilityLiveRegion="polite">
          <ActivityIndicator color={Brand.denim} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.stateBlock}>
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        </View>
      )}

      {!loading && summary && (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Payment summary
          </Text>
          <LineRow label="Deposit paid" amount={formatMoney(paid)} emphasize />
          <LineRow label="Estimated remaining" amount={formatMoney(remaining)} />
          <Text style={styles.muted}>
            The remaining balance -- including final groceries, rentals, taxes, and any approved
            adjustments -- is due after your experience. We will confirm the exact amount with you
            beforehand.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          What happens next
        </Text>
        <Text style={styles.body}>
          1. We will reach out to confirm your menu and any details.
        </Text>
        <Text style={styles.body}>
          2. Your chef prepares everything for your date.
        </Text>
        <Text style={styles.body}>
          3. You settle the remaining balance after the experience.
        </Text>
      </View>

      <View style={styles.footerCta}>
        <PrimaryButton label="Back to home" onPress={() => router.replace('/')} />
        <SecondaryButton label="Message our team" onPress={() => router.push({ pathname: '/messages', params: eventId ? { eventId } : {} })} />
      </View>
    </ScrollView>
  );
}

function LineRow({
  label,
  amount,
  emphasize,
}: {
  label: string;
  amount: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.lineRow}>
      <Text style={[styles.lineLabel, emphasize && styles.lineLabelStrong]}>{label}</Text>
      <Text style={[styles.lineAmount, emphasize && styles.lineAmountStrong]}>{amount}</Text>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.primaryButton}>
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
  error: { color: Brand.clay, fontSize: 14 },
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
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  lineLabel: { fontSize: 15, color: Brand.espresso },
  lineLabelStrong: { fontWeight: '700' },
  lineAmount: { fontSize: 15, color: Brand.espresso, fontVariant: ['tabular-nums'] },
  lineAmountStrong: { fontWeight: '700' },
  footerCta: { marginTop: 24, gap: 4 },
  primaryButton: {
    backgroundColor: Brand.denim,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  primaryButtonText: { color: Brand.cream, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  secondaryButtonText: { color: Brand.denim, fontWeight: '600' },
});
