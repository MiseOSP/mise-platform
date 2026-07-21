import type { ReactNode } from 'react';

import { getStripeModule, STRIPE_PUBLISHABLE_KEY } from '@/lib/stripe';

// AppStripeProvider (v2.0 Sections 48, 66).
//
// Wraps the app tree in Stripe's <StripeProvider> ONLY when the native SDK is
// available and a publishable key is configured. On web -- or before a native
// rebuild has linked the SDK -- it renders children unchanged, so the app still
// boots and the rest of the flow (estimate, server-authoritative deposit) stays
// fully testable. This keeps the integration honest: payments light up exactly
// when the platform can actually process them, and never pretend otherwise.

export default function AppStripeProvider({ children }: { children: ReactNode }) {
  const stripe = getStripeModule();

  // No native SDK (web / not yet linked) or no key -> pass through untouched.
  if (!stripe?.StripeProvider || !STRIPE_PUBLISHABLE_KEY) {
    return <>{children}</>;
  }

  const StripeProvider = stripe.StripeProvider;
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      {children}
    </StripeProvider>
  );
}
