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
import { useRouter } from 'expo-router';

import { fetchPublicExperiences, type PublicExperience } from '@/lib/experiences';
import { defaultOrganizationId } from '@/lib/config';
import { Brand } from '@/constants/theme';

// Public Signature Experience discovery (v2.0 Sections 28, 34).
//
// Reachable WITHOUT an account. Distinguishes products (Gather, COAST, Brunch
// Society, Dinner Club) from occasions -- occasions are described as who each
// experience serves, never modeled as separate products. Experiences are read
// from the catalog (not hard-coded screen text, v2.0 Section 12) via the public
// RLS policy in migration 025. The primary call to action on every card, and on
// the empty state, routes to the inquiry form.

// Formats pricing guidance. starting_price is stored as a numeric dollar amount
// on the experience catalog (guidance only; the binding deposit/total is always
// computed server-side per v2.0 Section 51).
function formatStartingPrice(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) return null;
  const dollars = Math.round(value);
  return `From $${dollars.toLocaleString('en-US')}`;
}

export default function DiscoverScreen() {
  const router = useRouter();
  const [experiences, setExperiences] = useState<PublicExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!defaultOrganizationId) {
        // Not something the client can fix; fall back to the inquiry CTA.
        setExperiences([]);
        return;
      }
      setExperiences(await fetchPublicExperiences(defaultOrganizationId));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'We could not load our experiences just now.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>Nashville Chef Service</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Signature Experiences
      </Text>
      <Text style={styles.body}>
        One-time, chef-led gatherings designed around your table. Explore what each experience
        is about, then tell us what you have in mind -- we&apos;ll craft it with you.
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
          <SecondaryButton label="Try again" onPress={load} />
        </View>
      )}

      {!loading && !error && experiences.length === 0 && (
        <View style={styles.stateBlock}>
          <Text style={styles.body}>
            Our signature experiences are being finalized. Start an inquiry and we&apos;ll walk
            you through the options personally.
          </Text>
        </View>
      )}

      {!loading &&
        !error &&
        experiences.map((exp) => (
          <ExperienceCard
            key={exp.id}
            experience={exp}
            onInquire={() => router.push('/inquiry')}
          />
        ))}

      <View style={styles.footerCta}>
        <PrimaryButton label="Start an inquiry" onPress={() => router.push('/inquiry')} />
      </View>
    </ScrollView>
  );
}

function ExperienceCard({
  experience,
  onInquire,
}: {
  experience: PublicExperience;
  onInquire: () => void;
}) {
  const price = formatStartingPrice(experience.startingPrice);
  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {experience.name}
      </Text>
      {experience.positioning ? (
        <Text style={styles.cardPositioning}>{experience.positioning}</Text>
      ) : null}
      {experience.description ? (
        <Text style={styles.cardBody}>{experience.description}</Text>
      ) : null}

      {experience.serviceFormat ? (
        <DetailRow label="Format" value={experience.serviceFormat} />
      ) : null}
      {experience.typicalGroupSize ? (
        <DetailRow label="Typical group" value={experience.typicalGroupSize} />
      ) : null}
      {experience.leadTimeNote ? (
        <DetailRow label="Lead time" value={experience.leadTimeNote} />
      ) : null}
      {experience.dietaryStatement ? (
        <DetailRow label="Dietary" value={experience.dietaryStatement} />
      ) : null}
      {price ? <DetailRow label="Pricing" value={`${price} (guidance)`} /> : null}

      <PrimaryButton label={`Inquire about ${experience.name}`} onPress={onInquire} />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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

// Brand palette from shared design tokens (v2.0 Section 43).
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
  stateBlock: { paddingVertical: 24, gap: 12 },
  error: { color: Brand.clay, fontSize: 14 },
  card: {
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: 18,
    marginTop: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: Brand.espresso },
  cardPositioning: { fontSize: 15, fontWeight: '600', color: Brand.denim },
  cardBody: { fontSize: 15, lineHeight: 22, color: Brand.espresso },
  detailRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  detailLabel: { fontSize: 13, fontWeight: '700', color: Brand.textMuted, width: 96 },
  detailValue: { fontSize: 13, color: Brand.espresso, flex: 1 },
  footerCta: { marginTop: 24 },
  primaryButton: {
    backgroundColor: Brand.denim,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 8,
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
