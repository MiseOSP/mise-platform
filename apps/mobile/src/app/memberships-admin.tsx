// Admin membership management (Phase 4 / spec Section 90).
// Three tabs: Plans (create/edit/activate offerings), Memberships (propose,
// activate, pause, cancel), and Requests (resolve member change requests).
// Admin-gated in the UI; RLS enforces the real authority server-side. Only
// per_event plans can be ACTIVATED in this release (ADR 0003); recurring_fee
// and hybrid are shown as "coming soon".
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import {
  MembershipPlan,
  Membership,
  MembershipChangeRequest,
  BillingModel,
  MemberType,
  isActivatableBillingModel,
  listAllPlans,
  createPlan,
  updatePlan,
  listMemberships,
  activateMembership,
  pauseMembership,
  cancelMembership,
  listOpenChangeRequests,
  resolveChangeRequest,
} from '@/lib/memberships';

const ADMIN_ROLES = new Set(['owner', 'admin']);
type TabKey = 'plans' | 'memberships' | 'requests';

const BILLING_MODELS: BillingModel[] = ['per_event', 'recurring_fee', 'hybrid'];
const MEMBER_TYPES: MemberType[] = ['household', 'business'];

function billingLabel(m: BillingModel): string {
  if (m === 'per_event') return 'Per event';
  if (m === 'recurring_fee') return 'Recurring fee (coming soon)';
  return 'Hybrid (coming soon)';
}

export default function MembershipsAdminScreen() {
  const { role, organizationId } = useAuth();
  const isAdmin = !!role && ADMIN_ROLES.has(role);
  const hasOrg = !!organizationId;

  const [tab, setTab] = useState<TabKey>('plans');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [requests, setRequests] = useState<MembershipChangeRequest[]>([]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    const [p, m, r] = await Promise.all([
      listAllPlans(organizationId),
      listMemberships(organizationId),
      listOpenChangeRequests(organizationId),
    ]);
    if (p.error) setError(p.error);
    setPlans(p.data ?? []);
    setMemberships(m.data ?? []);
    setRequests(r.data ?? []);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  // --- New plan form ---
  const [planName, setPlanName] = useState('');
  const [planMemberType, setPlanMemberType] = useState<MemberType>('household');
  const [planBilling, setPlanBilling] = useState<BillingModel>('per_event');
  const [planPrice, setPlanPrice] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  const submitPlan = async () => {
    if (!organizationId || !planName.trim() || savingPlan) return;
    setSavingPlan(true);
    setError(null);
    const res = await createPlan({
      organizationId,
      name: planName.trim(),
      memberType: planMemberType,
      billingModel: planBilling,
      basePriceCents: planPrice.trim() ? Math.round(Number(planPrice.trim()) * 100) : 0,
    });
    if (res.error) setError(res.error);
    else {
      setPlanName('');
      setPlanPrice('');
      await load();
    }
    setSavingPlan(false);
  };

  const togglePlanActive = async (plan: MembershipPlan) => {
    setError(null);
    const res = await updatePlan(plan.id, { active: !plan.active });
    if (res.error) setError(res.error);
    else await load();
  };

  // --- Membership transitions ---
  const doTransition = async (
    fn: () => Promise<{ error: string | null }>,
  ) => {
    setError(null);
    const res = await fn();
    if (res.error) setError(res.error);
    else await load();
  };

  const resolve = async (
    id: string,
    status: 'resolved' | 'declined',
  ) => {
    setError(null);
    const res = await resolveChangeRequest(id, status);
    if (res.error) setError(res.error);
    else await load();
  };

  if (!hasOrg) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>Join an organization to manage memberships.</Text>
      </View>
    );
  }
  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>Membership management is available to admins only.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Reserve memberships</Text>
      <View style={styles.tabRow}>
        {(['plans', 'memberships', 'requests'] as TabKey[]).map((k) => (
          <Pressable
            key={k}
            style={[styles.tabButton, tab === k && styles.tabButtonActive]}
            onPress={() => setTab(k)}>
            <Text style={[styles.tabButtonText, tab === k && styles.tabButtonTextActive]}>
              {k === 'plans' ? 'Plans' : k === 'memberships' ? 'Memberships' : `Requests${requests.length ? ` (${requests.length})` : ''}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : tab === 'plans' ? (
        <FlatList
          data={plans}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.form}>
              <Text style={styles.formTitle}>New plan</Text>
              <TextInput
                style={styles.input}
                placeholder="Plan name (e.g. Society Annual)"
                value={planName}
                onChangeText={setPlanName}
              />
              <View style={styles.chipRow}>
                {MEMBER_TYPES.map((mt) => (
                  <Pressable
                    key={mt}
                    onPress={() => setPlanMemberType(mt)}
                    style={[styles.chip, planMemberType === mt && styles.chipActive]}>
                    <Text style={[styles.chipText, planMemberType === mt && styles.chipTextActive]}>
                      {mt}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.chipRow}>
                {BILLING_MODELS.map((bm) => (
                  <Pressable
                    key={bm}
                    onPress={() => setPlanBilling(bm)}
                    style={[styles.chip, planBilling === bm && styles.chipActive]}>
                    <Text style={[styles.chipText, planBilling === bm && styles.chipTextActive]}>
                      {billingLabel(bm)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Reference price in dollars (optional)"
                value={planPrice}
                onChangeText={setPlanPrice}
                keyboardType="decimal-pad"
              />
              <Pressable
                style={[styles.submitButton, savingPlan && styles.submitButtonDisabled]}
                onPress={submitPlan}
                disabled={savingPlan}>
                <Text style={styles.submitButtonText}>{savingPlan ? 'Saving...' : 'Add plan'}</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.muted}>
                  {item.memberType}
                  {item.basePriceCents != null ? ` \u00b7 $${(item.basePriceCents / 100).toFixed(2)}` : ''}
                  {item.active ? '' : ' \u00b7 inactive'}
                </Text>
              </View>
              <Pressable onPress={() => togglePlanActive(item)}>
                <Text style={styles.link}>{item.active ? 'Deactivate' : 'Activate'}</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.muted}>No plans yet.</Text>}
        />
      ) : tab === 'memberships' ? (
        <FlatList
          data={memberships}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const plan = plans.find((p) => p.id === item.planId);
            const canActivate =
              item.status === 'proposed' &&
              (!plan || isActivatableBillingModel('per_event'));
            return (
              <View style={styles.rowColumn}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.rowTitle}>{plan?.name ?? 'Membership'}</Text>
                  <Text style={styles.statusBadge}>{item.status}</Text>
                </View>
                <Text style={styles.muted}>
                  {item.startDate ? `Started ${item.startDate}` : 'Not started'}
                </Text>
                <View style={styles.actionRow}>
                  {item.status === 'proposed' && canActivate ? (
                    <Pressable onPress={() => doTransition(() => activateMembership(item.id))}>
                      <Text style={styles.link}>Activate</Text>
                    </Pressable>
                  ) : null}
                  {item.status === 'active' ? (
                    <Pressable onPress={() => doTransition(() => pauseMembership(item.id))}>
                      <Text style={styles.link}>Pause</Text>
                    </Pressable>
                  ) : null}
                  {item.status === 'paused' ? (
                    <Pressable onPress={() => doTransition(() => activateMembership(item.id))}>
                      <Text style={styles.link}>Resume</Text>
                    </Pressable>
                  ) : null}
                  {['proposed', 'active', 'paused', 'past_due'].includes(item.status) ? (
                    <Pressable onPress={() => doTransition(() => cancelMembership(item.id))}>
                      <Text style={styles.linkDanger}>Cancel</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.muted}>No memberships yet.</Text>}
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.rowColumn}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.rowTitle}>{item.requestType}</Text>
                <Text style={styles.statusBadge}>{item.status}</Text>
              </View>
              {item.message ? <Text style={styles.body}>{item.message}</Text> : null}
              <View style={styles.actionRow}>
                <Pressable onPress={() => resolve(item.id, 'resolved')}>
                  <Text style={styles.link}>Mark resolved</Text>
                </Pressable>
                <Pressable onPress={() => resolve(item.id, 'declined')}>
                  <Text style={styles.linkDanger}>Decline</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.muted}>No open requests.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  tabRow: { flexDirection: 'row', marginBottom: 12 },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#eee',
    marginRight: 8,
  },
  tabButtonActive: { backgroundColor: '#111' },
  tabButtonText: { color: '#111', fontWeight: '600' },
  tabButtonTextActive: { color: '#fff' },
  listContent: { paddingBottom: 40 },
  form: { marginBottom: 16, padding: 12, borderRadius: 12, backgroundColor: '#f7f7f7' },
  formTitle: { fontWeight: '700', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  submitButton: { backgroundColor: '#111', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowColumn: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    gap: 4,
  },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  statusBadge: { fontSize: 12, fontWeight: '700', color: '#555' },
  body: { marginTop: 4, color: '#333' },
  muted: { color: '#777', marginTop: 2 },
  errorText: { color: '#b00020', marginBottom: 8 },
  link: { color: '#2a6df5', fontWeight: '600', marginRight: 16 },
  linkDanger: { color: '#b00020', fontWeight: '600', marginRight: 16 },
  actionRow: { flexDirection: 'row', marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  chipActive: { borderColor: '#111', backgroundColor: '#111' },
  chipText: { fontSize: 12, color: '#333' },
  chipTextActive: { color: '#fff' },
});
