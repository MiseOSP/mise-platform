import { useEffect, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AuthScreen } from '@/components/auth-screen';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import {
  fetchMyAgreementStatus,
  signCurrentAgreement,
  CURRENT_AGREEMENT_VERSION,
} from '@/lib/chef-agreements';

// Sprint 1: real Supabase email/password auth wired to organization_members
// role lookup via auth-context. Replace with the real Document 17 screens
// (Welcome / Chef Dashboard / Admin Dashboard) in later sprints.
export default function AccountScreen() {
  const { session, loading, role, organizationId, organizationName, signOut } = useAuth();

  const [agreementsLoading, setAgreementsLoading] = useState(false);
  const [hasSignedCurrent, setHasSignedCurrent] = useState(false);
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const [typedName, setTypedName] = useState('');
  const [signSubmitting, setSignSubmitting] = useState(false);
  const [signStatus, setSignStatus] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'chef' || !session || !organizationId) return;
    let cancelled = false;
    setAgreementsLoading(true);
    fetchMyAgreementStatus(session.user.id, organizationId).then((result) => {
      if (cancelled) return;
      setHasSignedCurrent(result.hasSignedCurrent);
      setAgreementError(result.error);
      setAgreementsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [role, session, organizationId]);

  const handleSignAgreement = async () => {
    if (!session || !organizationId) return;
    setSignStatus(null);
    setSignSubmitting(true);
    try {
      await signCurrentAgreement(session.user.id, organizationId, typedName);
      setHasSignedCurrent(true);
      setTypedName('');
      setSignStatus('Agreement signed. Thank you!');
    } catch (e) {
      setSignStatus(e instanceof Error ? e.message : 'Could not sign agreement.');
    } finally {
      setSignSubmitting(false);
    }
  };
  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading session...</ThemedText>
      </ThemedView>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Account</ThemedText>
      <ThemedText>Signed in as {session.user.email}</ThemedText>
      <ThemedText>Role: {role ?? 'no organization membership yet'}</ThemedText>
      <ThemedText>Organization: {organizationName ?? 'none'}</ThemedText>
      {role === 'chef' ? (
        <ThemedView style={styles.form}>
          <ThemedText type="smallBold">Independent contractor agreement</ThemedText>
          {agreementsLoading ? (
            <ThemedText>Checking your agreement status...</ThemedText>
          ) : hasSignedCurrent ? (
            <ThemedText>You have signed version {CURRENT_AGREEMENT_VERSION}.</ThemedText>
          ) : (
            <ThemedView style={styles.form}>
              <ThemedText>
                Please sign version {CURRENT_AGREEMENT_VERSION} of the independent contractor
                agreement before accepting event assignments.
              </ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Type your full legal name"
                value={typedName}
                onChangeText={setTypedName}
                editable={!signSubmitting}
              />
              <ThemedText
                onPress={signSubmitting ? undefined : handleSignAgreement}
                style={styles.button}>
                {signSubmitting ? 'Signing...' : 'Sign agreement'}
              </ThemedText>
            </ThemedView>
          )}
          {agreementError ? <ThemedText style={styles.error}>{agreementError}</ThemedText> : null}
          {signStatus ? <ThemedText>{signStatus}</ThemedText> : null}
        </ThemedView>
      ) : null}
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
  form: {
    gap: 8,
    marginTop: 8,
  },
  error: {
    color: '#d33',
  },
});
