import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput } from 'react-native';

import { AdminDashboardScreen } from '@/components/admin-dashboard-screen';
import { AuthScreen } from '@/components/auth-screen';
import { ChefPortalScreen } from '@/components/chef-portal-screen';
import { ClientPortalScreen } from '@/components/client-portal-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { createOrganizationForCurrentUser } from '@/lib/organizations';

const MANAGEMENT_ROLES = new Set(['owner', 'admin', 'manager']);

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
    return <AuthScreen />;
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
});
