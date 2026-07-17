import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { EventListItem } from '@/lib/events';

export function DashboardSummary({
  isManagement,
  isChef,
  events,
  teamSize,
}: {
  isManagement: boolean;
  isChef: boolean;
  events: EventListItem[];
  teamSize: number | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const upcomingCount = events.filter((e) => e.event_date && e.event_date >= today).length;
  const pendingResponseCount = events.filter((e) => e.assignment_status === 'pending').length;

  const stats: { label: string; value: string | number }[] = [
    { label: 'Upcoming events', value: upcomingCount },
  ];
  if (isChef) {
    stats.push({ label: 'Needs your response', value: pendingResponseCount });
  }
  if (isManagement) {
    stats.push({ label: 'Team members', value: teamSize ?? '\u2014' });
  }

  return (
    <ThemedView style={styles.summaryRow}>
      {stats.map((stat) => (
        <ThemedView key={stat.label} style={styles.summaryCard}>
          <ThemedText type="title" style={styles.summaryValue}>
            {stat.value}
          </ThemedText>
          <ThemedText style={styles.summaryLabel}>{stat.label}</ThemedText>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: 22,
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
});
