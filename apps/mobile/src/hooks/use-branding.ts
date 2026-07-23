import { useAuth } from '@/contexts/auth-context';
import { Brand } from '@/constants/theme';

export type ResolvedBranding = {
  name: string | null;
  tagline: string | null;
  background: string;
  text: string;
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  border: string;
  textMuted: string;
  fontFamily: string | null;
};

// Resolves the current tenant's branding into a concrete, non-null color set.
// Every field falls back to the canonical Brand palette when the organization
// has not set (or has not yet loaded) a custom value.
export function useBranding(): ResolvedBranding {
  const { branding, organizationName } = useAuth();
  return {
    name: branding?.brandName ?? organizationName ?? null,
    tagline: branding?.brandTagline ?? null,
    background: branding?.colorBackground ?? Brand.cream,
    text: branding?.colorText ?? Brand.espresso,
    primary: branding?.colorPrimary ?? Brand.denim,
    secondary: branding?.colorSecondary ?? Brand.sage,
    accent: branding?.colorAccent ?? Brand.clay,
    surface: branding?.colorSurface ?? Brand.surface,
    border: branding?.colorBorder ?? Brand.border,
    textMuted: branding?.colorTextMuted ?? Brand.textMuted,
    fontFamily: branding?.fontFamily ?? null,
  };
}
