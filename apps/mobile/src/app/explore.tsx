import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

// Sprint 1: real Supabase email/password auth wired to organization_members
// role lookup via auth-context. Replace with the real Document 17 screens
// (Welcome / Chef Dashboard / Admin Dashboard) in later sprints.
export default function AccountScreen() {
  const { session, loading, role, organizationName, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function handleSignIn() {
    setStatus('Signing in...');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setStatus(error ? error.message : null);
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading session...</ThemedText>
      </ThemedView>
    );
  }

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Sign in</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <ThemedText onPress={handleSignIn} style={styles.button}>
          Sign in
        </ThemedText>
        {status ? <ThemedText>{status}</ThemedText> : null}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Account</ThemedText>
      <ThemedText>Signed in as {session.user.email}</ThemedText>
      <ThemedText>Role: {role ?? 'no organization membership yet'}</ThemedText>
      <ThemedText>Organization: {organizationName ?? 'none'}</ThemedText>
      <ThemedText onPress={() => signOut()} style={styles.button}>
        Sign out
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
  button: {
    textAlign: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
});
