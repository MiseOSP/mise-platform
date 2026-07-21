import { useMemo, useState } from 'react';
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

import { createInquiryRelationship, type RelationshipType } from '@/lib/relationships';
import { Brand } from '@/constants/theme';

// Public intake screen (v2.0 Sections 28, 32, 33).
//
// Concise enough to complete on a phone, using progressive disclosure: we ask
// for the essentials first (who you are + how to reach you), then reveal the
// event details. No account is required (v2.0 Section 18). The submit goes
// through createInquiryRelationship, which posts to the public-inquiry Edge
// Function; the client performs NO financial calculation (v2.0 Section 51).

type ClientKind = 'household' | 'business' | 'other';
type DesiredService = 'signature' | 'reserve' | 'unsure';

const CLIENT_KINDS: { value: ClientKind; label: string }[] = [
  { value: 'household', label: 'Household' },
  { value: 'business', label: 'Business' },
  { value: 'other', label: 'Something else' },
];

const SERVICES: { value: DesiredService; label: string; hint: string }[] = [
  { value: 'signature', label: 'A Signature Experience', hint: 'A one-time dinner or gathering' },
  { value: 'reserve', label: 'NCS Reserve', hint: 'Recurring chef-led dining' },
  { value: 'unsure', label: 'Not sure yet', hint: "We'll help you decide" },
];

// The intake form collects a friendly "kind"; map it to the relationship
// type the data model uses (v2.0 Section 19). 'other' -> individual.
function toRelationshipType(kind: ClientKind | null): RelationshipType {
  if (kind === 'household') return 'household';
  if (kind === 'business') return 'business';
  return 'individual';
}

function isValidEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}

export default function InquiryScreen() {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 -- essentials
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [clientKind, setClientKind] = useState<ClientKind | null>(null);

  // Step 2 -- details (all optional so we don't over-ask before confirming fit)
  const [service, setService] = useState<DesiredService | null>(null);
  const [preferredDate, setPreferredDate] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [occasion, setOccasion] = useState('');
  const [dietary, setDietary] = useState('');
  const [referral, setReferral] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canContinue = useMemo(() => {
    const hasName = firstName.trim().length > 0 || lastName.trim().length > 0;
    const hasEmail = email.trim().length > 0 && isValidEmail(email);
    const hasPhone = phone.trim().length > 0;
    return hasName && (hasEmail || hasPhone);
  }, [firstName, lastName, email, phone]);

  const emailError =
    email.trim().length > 0 && !isValidEmail(email) ? 'Please enter a valid email address.' : null;

  async function handleSubmit() {
    setError(null);
    if (!canContinue) {
      setError('Please add your name and either an email or phone number.');
      setStep(1);
      return;
    }

    const displayName =
      [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') ||
      email.trim() ||
      phone.trim();

    // Assemble the free-text details into the inquiry note. Structured intake
    // fields (guest count, date, occasion) become admin-qualification data;
    // for the MVP we capture them as a readable note on the relationship.
    const detailLines = [
      service ? `Interested in: ${SERVICES.find((s) => s.value === service)?.label}` : null,
      preferredDate.trim() ? `Preferred date / cadence: ${preferredDate.trim()}` : null,
      guestCount.trim() ? `Approx. guests: ${guestCount.trim()}` : null,
      serviceArea.trim() ? `Service area: ${serviceArea.trim()}` : null,
      occasion.trim() ? `Occasion: ${occasion.trim()}` : null,
      dietary.trim() ? `Dietary notes: ${dietary.trim()}` : null,
      notes.trim() ? `Notes: ${notes.trim()}` : null,
    ].filter(Boolean);

    setSubmitting(true);
    const { error: submitError } = await createInquiryRelationship({
      relationshipType: toRelationshipType(clientKind),
      displayName,
      referralSource: referral.trim() || null,
      contact: {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      },
      notes: detailLines.length ? detailLines.join('\n') : null,
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
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.eyebrow}>Nashville Chef Service</Text>
        <Text style={styles.title}>Thank you — we've got it.</Text>
        <Text style={styles.body}>
          Someone from our team will be in touch personally to talk through the details and find
          the right experience for you. Keep an eye on your inbox and phone.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>Nashville Chef Service</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Let's start the conversation
        </Text>
        <Text style={styles.body}>
          Tell us a little about you and what you have in mind. It only takes a minute, and there's
          no account needed.
        </Text>

        <Text style={styles.stepLabel} accessibilityLabel={`Step ${step} of 2`}>
          Step {step} of 2
        </Text>

        {step === 1 && (
          <View style={styles.section}>
            <Field label="First name">
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                textContentType="givenName"
                accessibilityLabel="First name"
                placeholder="Your first name"
              />
            </Field>

            <Field label="Last name">
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                textContentType="familyName"
                accessibilityLabel="Last name"
                placeholder="Your last name"
              />
            </Field>

            <Field label="Email" error={emailError}>
              <TextInput
                style={[styles.input, emailError ? styles.inputError : null]}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                accessibilityLabel="Email address"
                placeholder="you@example.com"
              />
            </Field>

            <Field label="Phone">
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                accessibilityLabel="Phone number"
                placeholder="(615) 555-0123"
              />
            </Field>

            <Field label="Who is this for?">
              <View style={styles.choiceRow}>
                {CLIENT_KINDS.map((k) => (
                  <Choice
                    key={k.value}
                    label={k.label}
                    selected={clientKind === k.value}
                    onPress={() => setClientKind(k.value)}
                  />
                ))}
              </View>
            </Field>

            <Text style={styles.helper}>
              Add your name and either an email or phone so we can reach you.
            </Text>

            <PrimaryButton
              label="Continue"
              disabled={!canContinue}
              onPress={() => {
                setError(null);
                setStep(2);
              }}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.section}>
            <Field label="What are you interested in?">
              <View style={styles.choiceColumn}>
                {SERVICES.map((s) => (
                  <Choice
                    key={s.value}
                    label={s.label}
                    hint={s.hint}
                    selected={service === s.value}
                    onPress={() => setService(s.value)}
                    block
                  />
                ))}
              </View>
            </Field>

            <Field label="Preferred date or cadence">
              <TextInput
                style={styles.input}
                value={preferredDate}
                onChangeText={setPreferredDate}
                accessibilityLabel="Preferred date or cadence"
                placeholder="e.g. Sat May 17, or every other week"
              />
            </Field>

            <Field label="Approximate guests">
              <TextInput
                style={styles.input}
                value={guestCount}
                onChangeText={setGuestCount}
                keyboardType="number-pad"
                accessibilityLabel="Approximate number of guests"
                placeholder="e.g. 8"
              />
            </Field>

            <Field label="Service address or area">
              <TextInput
                style={styles.input}
                value={serviceArea}
                onChangeText={setServiceArea}
                accessibilityLabel="Service address or area"
                placeholder="Neighborhood or city"
              />
            </Field>

            <Field label="Occasion">
              <TextInput
                style={styles.input}
                value={occasion}
                onChangeText={setOccasion}
                accessibilityLabel="Occasion"
                placeholder="Birthday, anniversary, dinner party..."
              />
            </Field>

            <Field label="Dietary restrictions or allergies">
              <TextInput
                style={[styles.input, styles.multiline]}
                value={dietary}
                onChangeText={setDietary}
                accessibilityLabel="Dietary restrictions or allergies"
                placeholder="Anything we should know?"
                multiline
              />
            </Field>

            <Field label="How did you hear about us?">
              <TextInput
                style={styles.input}
                value={referral}
                onChangeText={setReferral}
                accessibilityLabel="Referral source"
                placeholder="A friend, Instagram, a past event..."
              />
            </Field>

            <Field label="Anything else?">
              <TextInput
                style={[styles.input, styles.multiline]}
                value={notes}
                onChangeText={setNotes}
                accessibilityLabel="Additional notes"
                placeholder="Tell us more about what you're imagining"
                multiline
              />
            </Field>

            {error && (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            )}

            <PrimaryButton
              label={submitting ? 'Sending...' : 'Send inquiry'}
              disabled={submitting}
              loading={submitting}
              onPress={handleSubmit}
            />

            <Pressable
              onPress={() => setStep(1)}
              accessibilityRole="button"
              style={styles.backLink}
              disabled={submitting}
            >
              <Text style={styles.backLinkText}>Back</Text>
            </Pressable>
          </View>
        )}

        {step === 1 && error && (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function Choice({
  label,
  hint,
  selected,
  onPress,
  block,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  block?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.choice,
        block ? styles.choiceBlock : null,
        selected ? styles.choiceSelected : null,
      ]}
    >
      <Text style={[styles.choiceText, selected ? styles.choiceTextSelected : null]}>{label}</Text>
      {hint ? <Text style={styles.choiceHint}>{hint}</Text> : null}
    </Pressable>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.button, disabled ? styles.buttonDisabled : null]}
    >
      {loading ? (
        <ActivityIndicator color={Brand.cream} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

// Brand palette now lives in shared design tokens (v2.0 Section 43); see
// constants/theme.ts. Screens consume Brand.* rather than redefining hex.
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.cream },
  container: { padding: 24, backgroundColor: Brand.cream, maxWidth: 640, width: '100%', alignSelf: 'center' },
  centered: { flex: 1, justifyContent: 'center' },
  eyebrow: { color: Brand.clay, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', fontSize: 12 },
  title: { fontSize: 28, fontWeight: '700', color: Brand.espresso, marginTop: 6, marginBottom: 10 },
  body: { fontSize: 16, lineHeight: 24, color: Brand.espresso },
  stepLabel: { marginTop: 20, marginBottom: 4, color: Brand.denim, fontWeight: '600' },
  section: { marginTop: 8 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: Brand.espresso, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Brand.espresso,
    minHeight: 48,
  },
  inputError: { borderColor: Brand.clay },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  fieldError: { color: Brand.clay, marginTop: 4, fontSize: 13 },
  helper: { color: Brand.textMuted, fontSize: 13, marginBottom: 12 },
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
