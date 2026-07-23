import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type OrgRole = 'owner' | 'admin' | 'manager' | 'chef' | 'client' | null;

type Membership = {
  userId: string | null;
  role: OrgRole;
  organizationId: string | null;
  organizationName: string | null;
};

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  userId: string | null;
  role: OrgRole;
  organizationId: string | null;
  organizationName: string | null;
  devRoleOverride: OrgRole;
  setDevRoleOverride: (role: OrgRole) => void;
  refreshMembership: () => Promise<void>;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
};

const emptyMembership: Membership = {
  userId: null,
  role: null,
  organizationId: null,
  organizationName: null,
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  ...emptyMembership,
  devRoleOverride: null,
  setDevRoleOverride: () => {},
  refreshMembership: async () => {},
  signOut: async () => {},
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
});

// Looks up the app-level `users` row and active organization_members / roles
// for a given Supabase Auth id. Returns an empty membership (not an error) for
// a brand-new auth identity that hasn't created/joined an organization yet --
// the onboarding screen is responsible for that step.
async function loadMembership(authId: string): Promise<Membership> {
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!userRow) return emptyMembership;

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, roles(name), organizations(name)')
    .eq('user_id', userRow.id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle();

  const roles = membership?.roles as unknown as { name: OrgRole } | null;
  const organizations = membership?.organizations as unknown as { name: string } | null;

  return {
    userId: userRow.id as string,
    role: roles?.name ?? null,
    organizationId: (membership?.organization_id as string | undefined) ?? null,
    organizationName: organizations?.name ?? null,
  };
}

// NOTE: This wires real session + organization_members/roles lookups. Screen
// building (Sprint 1 per docs/04_database_schema.md and Document 17) reads
// role/organizationId from here to decide what to render.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<Membership>(emptyMembership);
  const [devRoleOverride, setDevRoleOverride] = useState<OrgRole>(null);

  const applyMembership = useCallback(async (authId: string | null) => {
    if (!authId) {
      setMembership(emptyMembership);
      return;
    }
    const result = await loadMembership(authId);
    setMembership(result);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      const currentSession = data.session;
      const currentUserId = currentSession?.user?.id ?? null;
      if (!active) return;
      setSession(currentSession);
      await applyMembership(currentUserId);
      if (active) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      void applyMembership(newSession?.user?.id ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [applyMembership]);

  const refreshMembership = useCallback(async () => {
    await applyMembership(session?.user?.id ?? null);
  }, [applyMembership, session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      userId: membership.userId,
      role: __DEV__ && devRoleOverride ? devRoleOverride : membership.role,
      organizationId: membership.organizationId,
      organizationName: membership.organizationName,
      devRoleOverride,
      setDevRoleOverride,
      refreshMembership,
      signOut,
      signIn,
      signUp,
    }),
    [session, loading, membership, devRoleOverride, refreshMembership, signOut, signIn, signUp]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
