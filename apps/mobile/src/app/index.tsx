import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';

import { AdminDashboardScreen } from '@/components/admin-dashboard-screen';
import { AuthScreen } from '@/components/auth-screen';
import { ChefPortalScreen } from '@/components/chef-portal-screen';
import { ClientPortalScreen } from '@/components/client-portal-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { createOrganizationForCurrentUser } from '@/lib/organizations';

const MANAGEMENT_ROLES = new Set(['owner', 'admin', 'manager']);

// Public landing shown to visitors with no session (v2.0 Sections 18, 28, 32).
// Intake must be reachable WITHOUT an account, so the front door offers a
// primary "Start an inquiry" path and a secondary "Sign in" for returning
// clients and staff. Sign-in is revealed in place rather than gating the
// whole app behind a login wall.
function PublicLanding() {
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);

  if (showAuth) {
    return (
      <ThemedView style={styles.landing}>
        <AuthScreen />
        <Pressable
          onPress={() => setShowAuth(false)}
          accessibilityRole="button"
          style={styles.landingBackLink}
        >
          <ThemedText style={styles.landingLinkText}>Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.landing}>
      <ThemedView style={styles.landingCard}>
        <ThemedText style={styles.eyebrow}>Nashville Chef Service</ThemedText>
        <ThemedText type="title" style={styles.landingTitle}>
          Unforgettable dining, brought to your table
        </ThemedText>
        <ThemedText style={styles.landingBody}>
          Tell us what you have in mind and we&apos;ll craft the experience with you. No account
          needed to get started.
        </ThemedText>

        <Pressable
          onPress={() => router.push('/inquiry')}
          accessibilityRole="button"
          style={styles.primaryButton}
        >
          <ThemedText style={styles.primaryButtonText}>Start an inquiry</ThemedText>
        </Pressable>

        <Pressable
          onPress={() => setShowAuth(true)}
          accessibilityRole="button"
          style={styles.secondaryButton}
        >
          <ThemedText style={styles.secondaryButtonText}>
            Returning client or team member? Sign in
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

export default function HomeScreen() {
  const { session, loading, role, organizationId, organizationName, refreshMembership } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isManagement = !!role && MANAGEMENT_ROLES.has(role);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator />
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (!session) {
    return <PublicLanding />;
  }

  if (!organizationId) {
    const handleCreate = async () => {
      setError(null);
      if (orgName.trim().length < 2) {
        setError('Enter a name with at least 2 characters.');
        return;
      }
      setSubmitting(true);
      try {
        await createOrganizationForCurrentUser({
          authId: session.user.id,
          email: session.user.email ?? null,
          organizationName: orgName,
        });
        await refreshMembership();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create organization.');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Create your organization</ThemedText>
        <ThemedText>
          You&apos;re signed in, but not yet part of an organization. Create one to continue —
          you&apos;ll be its owner.
        </ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Organization name"
          value={orgName}
          onChangeText={setOrgName}
          editable={!submitting}
        />
        <ThemedText
          onPress={submitting ? undefined : handleCreate}
          style={[styles.button, submitting && styles.buttonDisabled]}
        >
          {submitting ? 'Creating...' : 'Create organization'}
        </ThemedText>
        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
      </ThemedView>
    );
  }

  if (isManagement) {
    return (
      <AdminDashboardScreen
        organizationId={organizationId}
        organizationName={organizationName}
        role={role}
        authId={session.user.id}
      />
    );
  }

  if (role === 'client') {
    return (
      <ClientPortalScreen
        organizationId={organizationId}
        organizationName={organizationName}
        role={role}
        authId={session.user.id}
      />
    );
  }

  return (
    <ChefPortalScreen
      organizationId={organizationId}
      organizationName={organizationName}
      role={role}
      authId={session.user.id}
    />
  );
}

const CREAM = '#FBF7F0';
const DENIM = '#3B5A78';
const ESPRESSO = '#3A2E28';
const CLAY = '#B4674E';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
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
  buttonDisabled: {
    opacity: 0.5,
  },
  error: {
    color: '#d33',
  },
  landing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: CREAM,
  },
  landingCard: {
    width: '100%',
    maxWidth: 480,
    gap: 12,
    backgroundColor: CREAM,
  },
  eyebrow: {
    color: CLAY,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  landingTitle: {
    color: ESPRESSO,
  },
  landingBody: {
    color: ESPRESSO,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: DENIM,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: CREAM,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: DENIM,
    fontWeight: '600',
  },
  landingBackLink: {
    alignItems: 'center',
    paddingVertical: 14,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  landingLinkText: {
    color: DENIM,
    fontWeight: '600',
  },
});
