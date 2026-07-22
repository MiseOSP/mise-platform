// Financial visibility admin screen (Phase 4, spec Sections 14, 15, 25, 51, 66, 90).
// Read-only: pick an event, see the server-authoritative financial summary
// (total, deposit due, paid, refunded, balance) plus the per-category charge
// breakdown. Money is NEVER computed or mutated here -- the server view
// event_financial_summary is the source of truth (spec S51); payments move
// only through Stripe webhooks (spec S66).
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { EventListItem, fetchEventsForRole } from '@/lib/events';
import {
  ChargeCategoryBreakdown,
  EventFinancialSummary,
  fetchEventChargeBreakdown,
  fetchEventFinancialSummary,
  formatMoney,
} from '@/lib/financials';

const STAFF_ROLES = new Set(['owner', 'admin', 'manager']);

function eventLabel(e: EventListItem): string {
  const when = e.event_date ?? 'No date';
  const what = e.occasion?.trim() || 'Event';
  const where = [e.city, e.state].filter(Boolean).join(', ');
  return where ? `${what} - ${when} - ${where}` : `${what} - ${when}`;
}

function prettyCategory(c: string): string {
  return c.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function FinancialsAdminScreen() {
  const { role, organizationId } = useAuth();
  const isStaff = !!role && STAFF_ROLES.has(role);
  const hasOrg = !!organizationId;

  const [events, setEvents] = useState<EventListItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [summary, setSummary] = useState<EventFinancialSummary | null>(null);
  const [breakdown, setBreakdown] = useState<ChargeCategoryBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!role || !organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: evErr } = await fetchEventsForRole(role, organizationId);
      if (evErr) throw evErr;
      setEvents(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load events.');
    } finally {
      setLoading(false);
    }
  }, [role, organizationId]);

  const loadDetail = useCallback(async (eventId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const [sumRes, breakRes] = await Promise.all([
        fetchEventFinancialSummary(eventId),
        fetchEventChargeBreakdown(eventId),
      ]);
      if (sumRes.error) throw new Error(sumRes.error);
      if (breakRes.error) throw new Error(breakRes.error);
      setSummary(sumRes.data);
      setBreakdown(breakRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load financials.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (selectedEventId) {
      loadDetail(selectedEventId);
    } else {
      setSummary(null);
      setBreakdown([]);
    }
  }, [selectedEventId, loadDetail]);

  if (!isStaff) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>This screen is for staff only.</Text>
      </View>
    );
  }

  if (!hasOrg) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>No organization selected.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  if (!selectedEvent) {
    return (
      <View style={styles.container}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.heading}>Pick an event</Text>
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          ListEmptyComponent={<Text style={styles.muted}>No events yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => setSelectedEventId(item.id)}>
              <Text style={styles.rowTitle}>{eventLabel(item)}</Text>
              <Text style={styles.rowMeta}>
                {(item.status ?? 'unknown').replace(/_/g, ' ')}
              </Text>
            </Pressable>
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setSelectedEventId(null)}>
        <Text style={styles.back}>{'< Back to events'}</Text>
      </Pressable>
      <Text style={styles.heading}>{eventLabel(selectedEvent)}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {detailLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : !summary ? (
        <Text style={styles.muted}>No financial record for this event yet.</Text>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <SummaryRow label="Total" value={formatMoney(summary.totalCents)} />
            <SummaryRow label="Deposit due" value={formatMoney(summary.depositDueCents)} />
            <SummaryRow label="Paid" value={formatMoney(summary.paidCents)} />
            <SummaryRow label="Refunded" value={formatMoney(summary.refundedCents)} />
            <SummaryRow
              label="Balance"
              value={formatMoney(summary.balanceCents)}
              emphasize
            />
          </View>

          <Text style={styles.section}>Charge breakdown</Text>
          {breakdown.length === 0 ? (
            <Text style={styles.muted}>No line items recorded.</Text>
          ) : (
            breakdown.map((b) => (
              <View key={b.category} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{prettyCategory(b.category)}</Text>
                  <Text style={styles.rowMeta}>
                    {b.lineCount} item{b.lineCount === 1 ? '' : 's'}
                    {b.depositEligible ? ' - deposit-eligible' : ''}
                  </Text>
                </View>
                <Text style={styles.amount}>{formatMoney(b.subtotalCents)}</Text>
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, emphasize && styles.emphasize]}>{label}</Text>
      <Text style={[styles.summaryValue, emphasize && styles.emphasize]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  section: { fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  back: { color: '#2563eb', marginBottom: 12 },
  summaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 14, color: '#374151' },
  summaryValue: { fontSize: 14, fontWeight: '500' },
  emphasize: { fontWeight: '700', fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d5db',
  },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '500' },
  muted: { color: '#6b7280' },
  error: { color: '#dc2626', marginBottom: 12 },
});
