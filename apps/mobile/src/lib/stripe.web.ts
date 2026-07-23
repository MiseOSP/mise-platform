// src/lib/stripe.web.ts
//
// Web-platform variant of ./stripe.ts. Metro resolves this file for the web
// bundle and the native ./stripe.ts for iOS/Android. The whole point of this
// split is that @stripe/stripe-react-native is a NATIVE-ONLY package: even a
// lazy require() of it forces Metro to include its native-only internals in
// the web bundle, which breaks the web build. This variant never references
// that package at all, so the web app bundles and runs cleanly. Card
// collection on web is handled separately (see deposit-card-form.web.tsx).

// Publishable (client-side) key -- safe to ship in the client bundle. The
// matching secret key lives ONLY in the Edge Function environment.
export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

// On web there is no native Stripe module to resolve.
export function getStripeModule(): any | null {
  return null;
}

// Card collection + confirmation can never run via the native SDK on web.
export function isStripeReady(): boolean {
  return false;
}
