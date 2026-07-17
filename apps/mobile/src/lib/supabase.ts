import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// react-native-url-polyfill assumes a browser-like global (`self`/`window`),
// which does not exist during Expo Router's static web export (Node/SSR).
// Only load it when a window actually exists (native runtime or client-side
// web) to avoid crashing the static export build.
if (typeof window !== 'undefined') {
  require('react-native-url-polyfill/auto');
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase env vars are missing. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file (see .env.example). ' +
      'Using a placeholder client until then; auth/data calls will fail.'
  );
}

// createClient() validates the URL immediately and throws if it is missing
// or malformed, which would crash the whole bundle (including web export)
// before .env is configured. Fall back to a syntactically valid placeholder
// so the app still boots; isSupabaseConfigured tells callers whether real
// credentials are present.
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
