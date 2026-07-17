import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type OrgRole = 'owner' | 'admin' | 'manager' | 'chef' | 'client' | null;

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  role: OrgRole;
  organizationId: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  role: null,
  organizationId: null,
  signOut: async () => {},
});

// NOTE: This is Sprint 0/1 scaffolding only. It wires the session and does a
// placeholder role lookup against organization_members. Real role-based
// routing/guarding should be filled in during Sprint 1 per docs/04_database_schema.md.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<OrgRole>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId) {
      setRole(null);
      setOrganizationId(null);
      return;
    }

    let cancelled = false;

    async function loadMembership(uid: string) {
      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id, roles ( name )')
        .eq('user_id', uid)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setRole(null);
        setOrganizationId(null);
        return;
      }

      setOrganizationId(data.organization_id ?? null);
      const roleName = (data as any)?.roles?.name ?? null;
      setRole(roleName);
    }

    loadMembership(userId);

    return () => {
      cancelled = true;
    };
  }, [session]);

  const value = useMemo(
    () => ({
      session,
      loading,
      role,
      organizationId,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading, role, organizationId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
