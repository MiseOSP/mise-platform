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
  fetchEventChargeBreakdown,
  fetchEventFinancialSummary,
  formatMoney,
  type ChargeCategory,
  type ChargeCategoryBreakdown,
  type EventFinancialSummary,
} from '@/lib/financials';
import { Brand } from '@/constants/theme';

// Client estimate / proposal review (v2.0 Section 35).
//
// Shows separately-labeled components (service subtotal, fixed add-ons, grocery
// estimate, rentals, taxes, adjustments) so the client understands exactly what
// is -- and is not -- included. CRITICAL (v2.0 Sections 51, 98): the client NEVER
// computes money. The deposit due, total, and balance are read from the
// server-authoritative event_financial_summary view; per-line labels come from
// the event_charge_breakdown view. Both are RLS-scoped to the client on the
// event. The screen explains that the deposit is based ONLY on eligible service
// and fixed add-on charges and does not imply groceries/other variable costs are
// included when they are not.

// Human labels for each charge category. Order controls display order in the
// breakdown so the estimate reads top-down like a proposal.
const CATEGORY_LABELS: Record<ChargeCategory, string> = {
  service: 'Service',
  fixed_add_on: 'Fixed add-ons',
  grocery_estimate: 'Grocery estimate',
  grocery_actual: 'Groceries (final)',
  rental: 'Rentals',
  tax: 'Taxes',
  adjustment: 'Adjustments',
  discount: 'Discounts',
  gratuity: 'Gratuity',
};

const CATEGORY_ORDER: ChargeCategory[] = [
  'service',
  'fixed_add_on',
  'grocery_estimate',
  'grocery_actual',
  'rental',
  'tax',
  'adjustment',
  'discount',
  'gratuity',
];

function sortBreakdown(rows: ChargeCategoryBreakdown[]): ChargeCategoryBreakdown[] {
  return [...rows].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );
}

export default function EstimateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const eventId = typeof params.eventId === 'string' ? params.eventId : undefined;

  const [summary, setSummary] = useState<EventFinancialSummary | null>(null);
  const [breakdown, setBreakdown] = useState<ChargeCategoryBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId) {
      setError('We could not find this proposal. Please use the link we sent you.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, breakdownRes] = await Promise.all([
        fetchEventFinancialSummary(eventId),
        fetchEventChargeBreakdown(eventId),
      ]);
      if (summaryRes.error) throw new Error(summaryRes.error);
      if (breakdownRes.error) throw new Error(breakdownRes.error);
      setSummary(summaryRes.data);
      setBreakdown(sortBreakdown(breakdownRes.data));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'We could not load your estimate just now.',
      );
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const hasGroceryEstimate = breakdown.some((r) => r.category === 'grocery_estimate');

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>Nashville Chef Service</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Your estimate
      </Text>
      <Text style={styles.body}>
        Here is what we have planned so far. Nothing is charged until you approve this proposal
        and pay the deposit.
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
          {eventId ? <SecondaryButton label="Try again" onPress={load} /> : null}
        </View>
      )}

      {!loading && !error && summary && (
        <>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Estimate breakdown
            </Text>
            {breakdown.length === 0 ? (
              <Text style={styles.muted}>
                Your chef is still finalizing the details. We will update this the moment it is
                ready.
              </Text>
            ) : (
              breakdown.map((row) => (
                <LineRow
                  key={row.category}
                  label={CATEGORY_LABELS[row.category]}
                  amount={formatMoney(row.subtotalCents)}
                  hint={row.category === 'grocery_estimate' ? 'Estimate -- billed at actual' : undefined}
                />
              ))
            )}
            <View style={styles.divider} />
            <LineRow label="Estimated total" amount={formatMoney(summary.totalCents)} emphasize />
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Deposit due today
            </Text>
            <LineRow label="Deposit" amount={formatMoney(summary.depositDueCents)} emphasize />
            <Text style={styles.muted}>
              Your deposit is 50% of eligible service and fixed add-on charges
              ({formatMoney(summary.depositBaseCents)}). Groceries, rentals, taxes, and later
              adjustments are not part of the deposit
              {hasGroceryEstimate ? ' -- grocery amounts are billed at actual cost.' : '.'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Remaining balance
            </Text>
            <LineRow label="Estimated remaining" amount={formatMoney(summary.balanceCents - summary.depositDueCents > 0 ? summary.balanceCents - summary.depositDueCents : summary.balanceCents)} />
            <Text style={styles.muted}>
              The remaining balance -- including final groceries, rentals, taxes, and any approved
              adjustments -- is due after your experience. We will confirm the exact amount with
              you before then.
            </Text>
          </View>

          <View style={styles.footerCta}>
            <PrimaryButton
              label="Review & approve proposal"
              onPress={() => router.push({ pathname: '/checkout', params: { eventId: eventId! } })}
            />
            <SecondaryButton label="I have a question" onPress={() => router.push('/inquiry')} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function LineRow({
  label,
  amount,
  hint,
  emphasize,
}: {
  label: string;
  amount: string;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.lineRow}>
      <View style={styles.lineLabelWrap}>
        <Text style={[styles.lineLabel, emphasize && styles.lineLabelStrong]}>{label}</Text>
        {hint ? <Text style={styles.lineHint}>{hint}</Text> : null}
      </View>
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
    alignItems: 'flex-start',
    paddingVertical: 6,
    gap: 12,
  },
  lineLabelWrap: { flex: 1 },
  lineLabel: { fontSize: 15, color: Brand.espresso },
  lineLabelStrong: { fontWeight: '700' },
  lineHint: { fontSize: 12, color: Brand.textMuted, marginTop: 2 },
  lineAmount: { fontSize: 15, color: Brand.espresso, fontVariant: ['tabular-nums'] },
  lineAmountStrong: { fontWeight: '700' },
  divider: { height: 1, backgroundColor: Brand.border, marginVertical: 8 },
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
