// Invite Staff (admin-only). Owners/admins pre-assign a chef/manager/admin/owner
// role by email BEFORE the person signs up; the signup trigger (migration 032)
// provisions the invited role on first login. Clients are NOT invited here --
// they self-serve at signup. Spec v2.0 SS18/65; ADR 0002.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { Brand } from '@/constants/theme';
import {
  createStaffInvitation,
  listStaffInvitations,
  revokeStaffInvitation,
  StaffInvitation,
  StaffRole,
} from '@/lib/staff-invitations';

// Only owners/admins can manage invitations (mirrors is_org_admin RLS).
const ADMIN_ROLES = ['owner', 'admin'];

// Roles an admin may invite. Client is intentionally excluded.
const INVITABLE_ROLES: { value: StaffRole; label: string }[] = [
  { value: 'chef', label: 'Chef' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
];

function statusLabel(inv: StaffInvitation): string {
  const expired =
    inv.status === 'pending' && new Date(inv.expiresAt).getTime() < Date.now();
  if (expired) return 'expired';
  return inv.status;
}

export default function InviteStaffScreen() {
  const { role, organizationId } = useAuth();
  const isAdmin = role ? ADMIN_ROLES.includes(role) : false;

  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [roleName, setRoleName] = useState<StaffRole>('chef');
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await listStaffInvitations(organizationId);
    if (!error && data) setInvitations(data);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleInvite() {
    if (!organizationId) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setStatus('Enter an email address.');
      return;
    }
    setSubmitting(true);
    setStatus(null);
    const { data, error, emailError } = await createStaffInvitation(
      trimmed,
      roleName,
      organizationId
    );
    setSubmitting(false);
    if (error) {
      setStatus(error);
      return;
    }
    if (data) {
      setEmail('');
      setStatus(
        emailError
          ? `Invited ${data.email} as ${data.roleName}, but the email could not be sent: ${emailError}`
          : `Invited ${data.email} as ${data.roleName}. An email is on the way.`
      );
      void load();
    }
  }

  async function handleRevoke(id: string) {
    const { error } = await revokeStaffInvitation(id);
    if (error) {
      setStatus(error);
      return;
    }
    void load();
  }

  if (!isAdmin) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Invite staff</ThemedText>
        <ThemedText style={styles.muted}>
          Only owners and admins can invite staff.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Invite staff</ThemedText>
      <ThemedText style={styles.subtitle}>
        Send a role by email before they sign up. When they create an account
        with this email, they get the role automatically.
      </ThemedText>

      <ThemedView style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Staff email"
          placeholderTextColor={Brand.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!submitting}
        />

        <ThemedView style={styles.roleRow}>
          {INVITABLE_ROLES.map((r) => {
            const selected = roleName === r.value;
            return (
              <ThemedText
                key={r.value}
                onPress={submitting ? undefined : () => setRoleName(r.value)}
                style={[styles.chip, selected ? styles.chipSelected : null]}
              >
                {r.label}
              </ThemedText>
            );
          })}
        </ThemedView>

        <ThemedText
          onPress={submitting ? undefined : handleInvite}
          style={styles.button}
        >
          {submitting ? 'Inviting...' : 'Send invite'}
        </ThemedText>
        {status ? <ThemedText style={styles.status}>{status}</ThemedText> : null}
      </ThemedView>

      <ThemedText type="subtitle">Invitations</ThemedText>
      {loading ? (
        <ActivityIndicator color={Brand.denim} />
      ) : (
        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <ThemedText style={styles.muted}>No invitations yet.</ThemedText>
          }
          renderItem={({ item }) => (
            <ThemedView style={styles.card}>
              <ThemedText style={styles.cardEmail}>{item.email}</ThemedText>
              <ThemedText style={styles.meta}>
                {item.roleName} • {statusLabel(item)}
              </ThemedText>
              {statusLabel(item) === 'pending' ? (
                <ThemedText
                  onPress={() => handleRevoke(item.id)}
                  style={styles.revoke}
                >
                  Revoke
                </ThemedText>
              ) : null}
            </ThemedView>
          )}
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
  subtitle: {
    color: Brand.textMuted,
    marginBottom: 4,
  },
  form: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: Brand.surface,
    color: Brand.espresso,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    color: Brand.espresso,
  },
  chipSelected: {
    backgroundColor: Brand.denimTint,
    borderColor: Brand.denim,
  },
  button: {
    backgroundColor: Brand.denim,
    color: Brand.surface,
    textAlign: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  status: {
    color: Brand.clay,
  },
  card: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: Brand.surface,
    gap: 2,
  },
  cardEmail: {
    color: Brand.espresso,
    fontWeight: '600',
  },
  meta: {
    color: Brand.textMuted,
  },
  revoke: {
    color: Brand.clay,
    marginTop: 6,
  },
  muted: {
    color: Brand.textMuted,
  },
});
