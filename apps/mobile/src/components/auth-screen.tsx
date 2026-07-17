import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Mode = 'sign-in' | 'sign-up';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const isWide = width >= 640;

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const inputStyle = [
    styles.input,
    {
      borderColor: colors.backgroundSelected,
      backgroundColor: colors.backgroundElement,
      color: colors.text,
    },
  ];

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (mode === 'sign-up' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (mode === 'sign-up' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const result =
        mode === 'sign-in'
          ? await signIn(trimmedEmail, password)
          : await signUp(trimmedEmail, password);

      if (result.error) {
        setError(result.error);
      } else if (mode === 'sign-up') {
        setInfo('Account created. Check your email if confirmation is required, then sign in.');
        setMode('sign-in');
        setPassword('');
        setConfirmPassword('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <ThemedView
        style={[
          styles.card,
          isWide && styles.cardWide,
          { borderColor: colors.backgroundSelected, backgroundColor: colors.backgroundElement },
        ]}
      >
        <ThemedText type="title" style={styles.title}>
          Mise
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          {mode === 'sign-in' ? 'Sign in to your workspace' : 'Create your account'}
        </ThemedText>

        <ThemedView style={styles.tabRow}>
          <Pressable
            onPress={() => {
              setMode('sign-in');
              setError(null);
              setInfo(null);
            }}
            style={[
              styles.tabButton,
              mode === 'sign-in' && { borderBottomColor: colors.text, borderBottomWidth: 2 },
            ]}
          >
            <ThemedText style={mode === 'sign-in' ? styles.tabTextActive : styles.tabText}>
              Sign in
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              setMode('sign-up');
              setError(null);
              setInfo(null);
            }}
            style={[
              styles.tabButton,
              mode === 'sign-up' && { borderBottomColor: colors.text, borderBottomWidth: 2 },
            ]}
          >
            <ThemedText style={mode === 'sign-up' ? styles.tabTextActive : styles.tabText}>
              Create account
            </ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.form}>
          <TextInput
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            editable={!submitting}
          />
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
            value={password}
            onChangeText={setPassword}
            editable={!submitting}
          />
          {mode === 'sign-up' && (
            <TextInput
              style={inputStyle}
              placeholder="Confirm password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              textContentType="newPassword"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!submitting}
            />
          )}

          <Pressable
            onPress={submitting ? undefined : handleSubmit}
            style={[styles.submitButton, { backgroundColor: colors.text }, submitting && styles.submitButtonDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <ThemedText style={[styles.submitText, { color: colors.background }]}>
                {mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </ThemedText>
            )}
          </Pressable>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
          {info ? <ThemedText style={styles.info}>{info}</ThemedText> : null}
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.five,
    gap: Spacing.two,
    ...Platform.select({
      web: { boxShadow: '0 8px 30px rgba(0,0,0,0.08)' },
      default: {},
    }),
  },
  cardWide: {
    padding: Spacing.six,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
    marginBottom: Spacing.three,
  },
  tabButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  tabText: {
    opacity: 0.6,
  },
  tabTextActive: {
    fontWeight: '600',
  },
  form: {
    gap: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  submitButton: {
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontWeight: '600',
    fontSize: 16,
  },
  error: {
    color: '#d33',
    textAlign: 'center',
  },
  info: {
    textAlign: 'center',
  },
});
