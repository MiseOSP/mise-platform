import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import {
  AvailabilitySlot,
  Weekday,
  addAvailability,
  fetchMyAvailability,
  fetchMyChefProfile,
  removeAvailability,
} from '@/lib/availability';

// Chef Portal (Phase 5, spec S91/S102): a chef sets which weekdays they are generally
// available. Every write is scoped to the chef's own rows by RLS (migration 036). This is
// advisory -- admins still assign events manually in the MVP (spec S15).

const DAYS: { key: Weekday; label: string }[] = [
  { key: 0, label: 'Sunday' },
  { key: 1, label: 'Monday' },
  { key: 2, label: 'Tuesday' },
  { key: 3, label: 'Wednesday' },
  { key: 4, label: 'Thursday' },
  { key: 5, label: 'Friday' },
  { key: 6, label: 'Saturday' },
];

export default function AvailabilityScreen() {
  const { role, organizationId } = useAuth();
  const isChef = role === 'chef';
  const hasOrg = !!organizationId;

  const [chefProfileId, setChefProfileId] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notChef, setNotChef] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setError(null);
    try {
      const profile = await fetchMyChefProfile(organizationId);
      if (!profile) {
        setNotChef(true);
        setSlots([]);
        return;
      }
      setChefProfileId(profile.chefProfileId);
      setSlots(await fetchMyAvailability(profile.chefProfileId));
    } catch (e: any) {
      setError(e?.message || 'Could not load your availability.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDay = async (weekday: Weekday) => {
    if (!chefProfileId || !organizationId) return;
    const existing = slots.find((s) => s.weekday === weekday);
    setSavingDay(weekday);
    setError(null);
    try {
      if (existing) {
        await removeAvailability(existing.id);
      } else {
        await addAvailability(organizationId, chefProfileId, weekday);
      }
      setSlots(await fetchMyAvailability(chefProfileId));
    } catch (e: any) {
      setError(e?.message || 'Could not update that day.');
    } finally {
      setSavingDay(null);
    }
  };

  if (!isChef) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Availability</Text>
        <Text style={styles.muted}>This screen is for chefs.</Text>
      </View>
    );
  }

  if (!hasOrg) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Availability</Text>
        <Text style={styles.muted}>Join an organization to manage your availability.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Availability</Text>
      <Text style={styles.muted}>
        Tap a day to mark yourself generally available. The office uses this to plan staffing.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : notChef ? (
        <Text style={styles.muted}>You do not have a chef profile in this organization yet.</Text>
      ) : (
        <View style={styles.card}>
          {DAYS.map((d) => {
            const on = slots.some((s) => s.weekday === d.key);
            const busy = savingDay === d.key;
            return (
              <Pressable
                key={d.key}
                disabled={busy}
                onPress={() => toggleDay(d.key)}
                style={[styles.dayRow, on && styles.dayRowOn]}
              >
                <Text style={[styles.dayLabel, on && styles.dayLabelOn]}>{d.label}</Text>
                <Text style={[styles.dayState, on && styles.dayStateOn]}>
                  {busy ? 'Saving...' : on ? 'Available' : 'Off'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  muted: { color: '#777', marginBottom: 12 },
  errorText: { color: '#b00020', marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  dayRowOn: { backgroundColor: '#eef7f0' },
  dayLabel: { fontSize: 16, color: '#333' },
  dayLabelOn: { fontWeight: '700', color: '#111' },
  dayState: { fontSize: 13, fontWeight: '700', color: '#999' },
  dayStateOn: { color: '#0f7a34' },
});
