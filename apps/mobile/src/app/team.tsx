import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

type MemberRow = {
  id: string;
  role_id: string;
  status: string;
  users: { email: string | null } | null;
  roles: { name: string } | null;
};

// Roles a manager can assign to someone else. 'owner' is intentionally
// excluded from self-service assignment here -- ownership transfer is a more
// sensitive operation to handle explicitly later.
const ASSIGNABLE_ROLES = ['admin', 'manager', 'chef', 'client'];

// Sprint 1: organization member management for owner/admin/manager. NOTE:
// adding a member currently requires that person to have already signed up
// with that email (we look them up in the app-level `users` table). A real
// invite-by-email flow (via an Edge Function using the service role) is a
// follow-up -- see supabase/functions/README.md.
export default function TeamScreen() {
  const { organizationId } = useAuth();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [roleName, setRoleName] = useState<string>('client');
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('organization_members')
      .select('id, role_id, status, users(email), roles(name)')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (!error && data) setMembers(data as unknown as MemberRow[]);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function handleAddMember() {
    setStatus(null);
    if (!organizationId) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setStatus('Enter an email address.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (userError) throw userError;
      if (!existingUser) {
        setStatus(`No account found for ${trimmedEmail}. They need to sign up first.`);
        return;
      }

      const { data: role, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .single();
      if (roleError || !role) throw roleError ?? new Error('Role not found.');

      const { error: insertError } = await supabase.from('organization_members').insert({
        organization_id: organizationId,
        user_id: existingUser.id,
        role_id: role.id,
      });
      if (insertError) throw insertError;

      setEmail('');
      setStatus(`Added ${trimmedEmail} as ${roleName}.`);
      await loadMembers();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Could not add member.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Team</ThemedText>

      <ThemedView style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Member email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!submitting}
        />
        <ThemedView style={styles.roleRow}>
          {ASSIGNABLE_ROLES.map((r) => (
            <ThemedText
              key={r}
              onPress={() => setRoleName(r)}
              style={[styles.roleChip, roleName === r && styles.roleChipSelected]}>
              {r}
            </ThemedText>
          ))}
        </ThemedView>
        <ThemedText onPress={submitting ? undefined : handleAddMember} style={styles.button}>
          {submitting ? 'Adding...' : 'Add member'}
        </ThemedText>
        {status ? <ThemedText>{status}</ThemedText> : null}
      </ThemedView>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ThemedView style={styles.memberRow}>
              <ThemedText>{item.users?.email ?? 'unknown'}</ThemedText>
              <ThemedText>
                {item.roles?.name ?? 'unknown'} - {item.status}
              </ThemedText>
            </ThemedView>
          )}
          ListEmptyComponent={<ThemedText>No members yet.</ThemedText>}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    padding: 24,
  },
  form: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  roleChipSelected: {
    borderColor: '#333',
    fontWeight: 'bold',
  },
  button: {
    textAlign: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
});
