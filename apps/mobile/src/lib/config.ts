// Public client configuration.
//
// These values are safe to ship in the client bundle (they are EXPO_PUBLIC_*).
// The public org id identifies which tenant (Nashville Chef Service in the
// pilot) an anonymous inquiry belongs to. We read it from config rather than
// hard-coding a Nashville-specific UUID (v2.0 Section 98: do not hard-code
// Nashville assumptions where configuration is practical).

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

/**
 * Base URL for Supabase Edge Functions, derived from the project URL.
 * e.g. https://<ref>.supabase.co -> https://<ref>.supabase.co/functions/v1
 */
export const functionsBaseUrl = rawUrl ? `${rawUrl.replace(/\/$/, '')}/functions/v1` : '';

/** Anon key, sent as the apikey header on Edge Function calls. */
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * The organization a public inquiry is attributed to. Set
 * EXPO_PUBLIC_DEFAULT_ORG_ID in .env to the NCS organization id.
 */
export const defaultOrganizationId = process.env.EXPO_PUBLIC_DEFAULT_ORG_ID ?? '';

/** Whether public intake has everything it needs to submit. */
export const isPublicIntakeConfigured = Boolean(
  functionsBaseUrl && supabaseAnonKey && defaultOrganizationId,
);
