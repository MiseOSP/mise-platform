import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import type { DepositCardFormProps } from './deposit-card-form';

// DepositCardForm -- web stub (v2.0 Sections 48, 66).
//
// @stripe/stripe-react-native is native-only and cannot render under
// react-native-web. Metro resolves this file for the web build so checkout.tsx
// can import DepositCardForm unconditionally without pulling in the native SDK.
//
// In practice checkout.tsx gates the real card form behind isStripeReady(),
// which is false on web, so this stub is a safety net rather than a primary UI
// path. It never claims a charge occurred.

export default function DepositCardForm(_props: DepositCardFormProps) {
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={styles.title}>
        Secure payment
      </Text>
      <Text style={styles.muted}>
        Card payment is available in the Nashville Chef Service mobile app. Open this proposal
        on your phone to pay your deposit securely. Your deposit amount is locked and confirmed
        by our team.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: 18,
    marginTop: 16,
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: '700', color: Brand.espresso },
  muted: { fontSize: 13, lineHeight: 20, color: Brand.textMuted },
});
