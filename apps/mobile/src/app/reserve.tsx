import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import {
  createReserveInterest,
  type RecurringFeeInterval,
} from '@/lib/memberships';
import { Brand } from '@/constants/theme';

// NCS Reserve interest screen (v2.0 Sections 7, 10, 32, 39, 89).
//
// A lightweight, account-free lead capture for the recurring membership channel.
// Per ADR 0001 this creates NO membership and NO charge: it routes interest to
// an admin for a consultation. The client performs no financial calculation
// (Section 51). Existing members manage their membership from the dashboard;
// this screen is the top of the Reserve funnel.

type Cadence = RecurringFeeInterval;

const CADENCES: { value: Cadence; label: string; hint: string }[] = [
  { value: 'weekly', label: 'Weekly', hint: 'A chef-led dinner every week' },
  { value: 'biweekly', label: 'Every other week', hint: 'Twice a month' },
  { value: 'monthly', label: 'Monthly', hint: 'One standing dinner each month' },
];

const DAYS: { value: number; label: string }[] = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export default function ReserveScreen() {
  const router = useRouter();
  const [cadence, setCadence] = useState<Cadence | null>(null);
  const [preferredDay, setPreferredDay] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!cadence) {
      setError('Please choose how often you would like a chef to visit.');
      return;
    }
    setSubmitting(true);
    const { error: submitError } = await createReserveInterest({
      desiredCadence: cadence,
      preferredDayOfWeek: preferredDay,
      notes: notes.trim() ? notes.trim() : null,
    });
    setSubmitting(false);
    if (submitError) {
      setError(submitError);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <View style={styles.centered}>
        <View style={styles.container}>
          <Text style={styles.eyebrow}>NCS Reserve</Text>
          <Text style={styles.title}>We'll be in touch</Text>
          <Text style={styles.body}>
            Thank you for your interest in a Reserve membership. A member of the
            Nashville Chef Service team will reach out personally to design a
            cadence and chef pairing that fits your household. There is nothing
            to pay now.
          </Text>
          <Pressable style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.centered} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Text style={styles.eyebrow}>NCS Reserve</Text>
          <Text style={styles.title}>A standing seat at your table</Text>
          <Text style={styles.body}>
            Reserve is a recurring private-chef membership: the same trusted team,
            on a rhythm that suits your household. Tell us how often you'd like us,
            and we'll design the rest together. No account or payment required to
            express interest.
          </Text>

          <Text style={styles.stepLabel}>How often?</Text>
          <View style={styles.choiceColumn}>
            {CADENCES.map((c) => {
              const selected = cadence === c.value;
              return (
                <Pressable
                  key={c.value}
                  style={[styles.choice, styles.choiceBlock, selected && styles.choiceSelected]}
                  onPress={() => setCadence(c.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                    {c.label}
                  </Text>
                  <Text style={styles.choiceHint}>{c.hint}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.stepLabel}>Preferred day (optional)</Text>
          <View style={styles.choiceRow}>
            {DAYS.map((d) => {
              const selected = preferredDay === d.value;
              return (
                <Pressable
                  key={d.value}
                  style={[styles.choice, selected && styles.choiceSelected]}
                  onPress={() => setPreferredDay(selected ? null : d.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.stepLabel}>Anything we should know? (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Household size, dietary needs, favorite occasions..."
            placeholderTextColor={Brand.textMuted}
            multiline
            accessibilityLabel="Additional notes"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={Brand.cream} />
            ) : (
              <Text style={styles.buttonText}>Request a consultation</Text>
            )}
          </Pressable>

          <Pressable style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Not now</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.cream },
  centered: { flexGrow: 1, justifyContent: 'center' },
  container: {
    padding: 24,
    backgroundColor: Brand.cream,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    color: Brand.clay,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Brand.espresso,
    marginTop: 6,
    marginBottom: 10,
  },
  body: { fontSize: 16, lineHeight: 24, color: Brand.espresso },
  stepLabel: { marginTop: 20, marginBottom: 8, color: Brand.denim, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Brand.surface,
    fontSize: 15,
    color: Brand.espresso,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceColumn: { gap: 8 },
  choice: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Brand.surface,
    minHeight: 48,
    justifyContent: 'center',
  },
  choiceBlock: { width: '100%' },
  choiceSelected: { borderColor: Brand.denim, backgroundColor: Brand.denimTint },
  choiceText: { fontSize: 15, fontWeight: '600', color: Brand.espresso },
  choiceTextSelected: { color: Brand.denim },
  choiceHint: { fontSize: 13, color: Brand.textMuted, marginTop: 2 },
  button: {
    backgroundColor: Brand.denim,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonDisabled: { backgroundColor: Brand.denimDisabled },
  buttonText: { color: Brand.cream, fontSize: 16, fontWeight: '700' },
  backLink: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  backLinkText: { color: Brand.denim, fontWeight: '600' },
  error: { color: Brand.clay, marginTop: 12, fontSize: 14 },
});
