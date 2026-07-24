// Stripe SDK access helper (v2.0 Sections 48, 66).
//
// @stripe/stripe-react-native is a NATIVE-only module: it does not run under
// react-native-web. To keep the app buildable and testable on web (our primary
// preview target today), we never statically import it. Instead we lazy-require
// it and expose small capability helpers so the checkout screen can degrade
// gracefully when the SDK is not available (web, or before a native rebuild).
//
// The client NEVER handles the deposit amount here -- that is decided by the
// server (create-deposit-intent reads event_financial_summary). This module
// only concerns itself with card collection + PaymentIntent confirmation.

import { Platform } from 'react-native';

// Publishable (client-side) key. This is NOT a secret -- it is safe to ship in
// the client bundle. The matching secret key lives ONLY in the Edge Function
// environment (STRIPE_SECRET_KEY) and is never referenced here.
export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

// Lazily resolves the native Stripe module, or null if it cannot be loaded
// (web, or a native build that has not linked the SDK yet).
export function getStripeModule(): any | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@stripe/stripe-react-native');
  } catch {
    return null;
  }
}

// True when card collection + confirmation can actually run on this device.
// Requires both the native module AND a configured publishable key.
export function isStripeReady(): boolean {
  return !!getStripeModule() && STRIPE_PUBLISHABLE_KEY.length > 0;
}
