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

// Per-tenant branding pulled from the organizations row (migration 037).
// Any null field falls back to the canonical Brand palette in constants/theme.
export type OrgBranding = {
  brandName: string | null;
  brandTagline: string | null;
  colorBackground: string | null;
  colorText: string | null;
  colorPrimary: string | null;
  colorSecondary: string | null;
  colorAccent: string | null;
  colorSurface: string | null;
  colorBorder: string | null;
  colorTextMuted: string | null;
  fontFamily: string | null;
};

type Membership = {
  userId: string | null;
  role: OrgRole;
  organizationId: string | null;
  organizationName: string | null;
  branding: OrgBranding | null;
};

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  userId: string | null;
  role: OrgRole;
  organizationId: string | null;
  organizationName: string | null;
  branding: OrgBranding | null;
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
  branding: null,
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
    .select('organization_id, roles(name), organizations(name, brand_name, brand_tagline, color_background, color_text, color_primary, color_secondary, color_accent, color_surface, color_border, color_text_muted, font_family)')
    .eq('user_id', userRow.id)
    .eq('status', 'active')
    .is('deleted_at', null);

  // A user may hold several roles in one org (e.g. an owner who also cooks).
  // Pick the highest-privilege active membership as the primary one.
  type MemberRow = {
    organization_id: string | null;
    roles: { name: OrgRole } | null;
    organizations: {
      name: string;
      brand_name: string | null;
      brand_tagline: string | null;
      color_background: string | null;
      color_text: string | null;
      color_primary: string | null;
      color_secondary: string | null;
      color_accent: string | null;
      color_surface: string | null;
      color_border: string | null;
      color_text_muted: string | null;
      font_family: string | null;
    } | null;
  };
  const rows = (membership ?? []) as unknown as MemberRow[];
  const PRIORITY: OrgRole[] = ['owner', 'admin', 'manager', 'chef', 'client'];
  const rank = (r: OrgRole) => {
    const i = PRIORITY.indexOf(r);
    return i === -1 ? PRIORITY.length : i;
  };
  const primary =
    rows.length > 0
      ? [...rows].sort((a, b) => rank(a.roles?.name ?? null) - rank(b.roles?.name ?? null))[0]
      : null;
  const roles = primary?.roles ?? null;
  const organizations = primary?.organizations ?? null;
  const org = primary?.organizations ?? null;
  const branding: OrgBranding | null = org
    ? {
        brandName: org.brand_name,
        brandTagline: org.brand_tagline,
        colorBackground: org.color_background,
        colorText: org.color_text,
        colorPrimary: org.color_primary,
        colorSecondary: org.color_secondary,
        colorAccent: org.color_accent,
        colorSurface: org.color_surface,
        colorBorder: org.color_border,
        colorTextMuted: org.color_text_muted,
        fontFamily: org.font_family,
      }
    : null;

  return {
    userId: userRow.id as string,
    role: roles?.name ?? null,
    organizationId: (primary?.organization_id as string | undefined) ?? null,
    organizationName: organizations?.name ?? null,
    branding,
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
      branding: membership.branding,
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
