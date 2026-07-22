// Calendar / agenda admin screen (Phase 4, spec Sections 22, 30, 51, 90).
// Staff view of events organized by date. Agenda-style (grouped by month, then
// day) rather than a month grid -- far more usable on mobile and needs no extra
// dependency. Read-only; toggles between Upcoming and Past. RLS scopes which
// events are returned server-side (spec S51 -- UI visibility is not authz).
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { EventListItem, fetchEventsForRole } from '@/lib/events';

const STAFF_ROLES = new Set(['owner', 'admin', 'manager']);

type Section = { key: string; label: string; items: EventListItem[] };

function todayYmd(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function monthLabel(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  if (isNaN(d.getTime())) return 'Undated';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function dayLabel(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  if (isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function timeLabel(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = Number(h);
  if (isNaN(hour)) return t;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m ?? '00'} ${ampm}`;
}

export default function CalendarScreen() {
  const { role, organizationId } = useAuth();
  const isStaff = !!role && STAFF_ROLES.has(role);
  const hasOrg = !!organizationId;

  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(async () => {
    if (!role || !organizationId) return;
    setError(null);
    try {
      const { data, error: err } = await fetchEventsForRole(role, organizationId);
      if (err) throw new Error(err);
      setEvents(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load calendar.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const sections = useMemo<Section[]>(() => {
    const today = todayYmd();
    const filtered = events.filter((e) => {
      if (!e.event_date) return !showPast;
      return showPast ? e.event_date < today : e.event_date >= today;
    });
    const sorted = [...filtered].sort((a, b) => {
      const da = a.event_date ?? '';
      const db = b.event_date ?? '';
      if (da === db) return (a.start_time ?? '').localeCompare(b.start_time ?? '');
      return showPast ? db.localeCompare(da) : da.localeCompare(db);
    });
    const map = new Map<string, EventListItem[]>();
    for (const e of sorted) {
      const key = e.event_date ? monthLabel(e.event_date) : 'Undated';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).map(([label, items]) => ({
      key: label,
      label,
      items,
    }));
  }, [events, showPast]);

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

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, !showPast && styles.toggleActive]}
          onPress={() => setShowPast(false)}
        >
          <Text style={[styles.toggleText, !showPast && styles.toggleTextActive]}>Upcoming</Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, showPast && styles.toggleActive]}
          onPress={() => setShowPast(true)}
        >
          <Text style={[styles.toggleText, showPast && styles.toggleTextActive]}>Past</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {sections.length === 0 ? (
          <Text style={styles.muted}>
            {showPast ? 'No past events.' : 'No upcoming events.'}
          </Text>
        ) : (
          sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <Text style={styles.monthHeader}>{section.label}</Text>
              {section.items.map((e) => (
                <View key={e.id} style={styles.eventRow}>
                  <View style={styles.dateCol}>
                    <Text style={styles.dayText}>
                      {e.event_date ? dayLabel(e.event_date) : 'TBD'}
                    </Text>
                    {e.start_time ? (
                      <Text style={styles.timeText}>{timeLabel(e.start_time)}</Text>
                    ) : null}
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.eventTitle}>{e.occasion?.trim() || 'Event'}</Text>
                    <Text style={styles.eventMeta}>
                      {(e.status ?? 'unknown').replace(/_/g, ' ')}
                      {e.guest_count ? ` - ${e.guest_count} guests` : ''}
                      {e.city ? ` - ${e.city}${e.state ? `, ${e.state}` : ''}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { paddingBottom: 32 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#9ca3af',
  },
  toggleActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  toggleText: { fontSize: 13, color: '#374151' },
  toggleTextActive: { color: '#ffffff' },
  section: { marginBottom: 20 },
  monthHeader: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  eventRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  dateCol: { width: 96 },
  dayText: { fontSize: 13, fontWeight: '600', color: '#111827' },
  timeText: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  infoCol: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '500' },
  eventMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  muted: { color: '#6b7280' },
  error: { color: '#dc2626', marginBottom: 12 },
});
