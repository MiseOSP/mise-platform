import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CardField, useConfirmPayment } from '@stripe/stripe-react-native';

import { Brand } from '@/constants/theme';

// DepositCardForm -- native implementation (v2.0 Sections 48, 66).
//
// Collects card details with Stripe's PCI-compliant CardField (raw card data
// never touches our JS) and confirms the PaymentIntent using the clientSecret
// returned by create-deposit-intent. On success, the stripe-webhook marks the
// payment paid server-side and we notify the parent via onPaid().
//
// This file statically imports @stripe/stripe-react-native, so it must only be
// bundled where the SDK exists. The web build resolves deposit-card-form.web.tsx
// instead, and checkout.tsx gates rendering behind isStripeReady().

export type DepositCardFormProps = {
  clientSecret: string;
  amountLabel: string;
  onPaid: () => void;
};

export default function DepositCardForm({ clientSecret, amountLabel, onPaid }: DepositCardFormProps) {
  const { confirmPayment, loading } = useConfirmPayment();
  const [cardComplete, setCardComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPay() {
    setError(null);
    const { error: err, paymentIntent } = await confirmPayment(clientSecret, {
      paymentMethodType: 'Card',
    });
    if (err) {
      setError(err.message ?? 'Payment could not be completed. Please try again.');
      return;
    }
    if (paymentIntent) {
      onPaid();
    }
  }

  const disabled = !cardComplete || loading;

  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        Secure payment
      </Text>
      <CardField
        postalCodeEnabled
        placeholders={{ number: '4242 4242 4242 4242' }}
        cardStyle={{
          backgroundColor: Brand.cream,
          textColor: Brand.espresso,
          borderColor: Brand.border,
          borderWidth: 1,
          borderRadius: 10,
        }}
        style={styles.cardField}
        onCardChange={(details: { complete: boolean }) => setCardComplete(details.complete)}
      />

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={disabled ? undefined : onPay}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={[styles.button, disabled && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Processing...' : `Pay ${amountLabel} deposit`}
        </Text>
      </Pressable>
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
    gap: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Brand.espresso },
  cardField: { height: 50, width: '100%' },
  error: { color: Brand.clay, fontSize: 14 },
  button: {
    backgroundColor: Brand.denim,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Brand.cream, fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
