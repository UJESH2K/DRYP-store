import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiCall } from '../../src/lib/api';
import { useToastStore } from '../../src/state/toast';
import { Ionicons } from '@expo/vector-icons';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';

function detectCardBrand(number: string): string {
  const cleanNumber = number.replace(/\s/g, '');
  if (cleanNumber.startsWith('4')) return 'Visa';
  if (cleanNumber.startsWith('5') || (cleanNumber.startsWith('2') && parseInt(cleanNumber.slice(0, 4)) >= 2221 && parseInt(cleanNumber.slice(0, 4)) <= 2720)) return 'Mastercard';
  if (cleanNumber.startsWith('34') || cleanNumber.startsWith('37')) return 'American Express';
  if (cleanNumber.startsWith('6')) return 'Discover';
  return 'Unknown';
}

export default function AddPaymentMethodScreen() {
  const router = useCustomRouter();
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  const cardBrand = useMemo(() => detectCardBrand(cardData.number), [cardData.number]);

  const handleAddCard = async () => {
    if (!cardData.number || !cardData.expiry || !cardData.cvc || !cardData.name) {
      showToast('Please fill in all fields.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      // This is a mock. In a real app, you would use a payment provider's SDK
      // to tokenize the card details before sending them to your server.
      const last4 = cardData.number.slice(-4);
      const brand = cardBrand || 'Visa';

      const newMethod = {
        type: 'card',
        last4,
        brand,
      };

      const result = await apiCall('/api/payments/methods', {
        method: 'POST',
        body: JSON.stringify(newMethod),
      });

      if (result) {
        showToast('Payment method added successfully!', 'success');
        router.back();
      } else {
        throw new Error('Failed to add payment method.');
      }
    } catch (error: any) {
      console.error('Add payment method error:', error);
      const errorMessage = error?.data?.message || 'An unexpected error occurred.';
      showToast(errorMessage, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.title}>Add Payment Method</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.form}>
        <View style={styles.demoBanner}>
          <Text style={styles.demoText}>Demo Mode — No real payment is processed</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Card Number"
          keyboardType="number-pad"
          value={cardData.number}
          onChangeText={(text) => setCardData(p => ({ ...p, number: text }))}
        />
        {cardBrand !== 'Unknown' && (
          <Text style={styles.brandText}>Detected: {cardBrand}</Text>
        )}
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="MM/YY"
            keyboardType="number-pad"
            value={cardData.expiry}
            onChangeText={(text) => setCardData(p => ({ ...p, expiry: text }))}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="CVC"
            keyboardType="number-pad"
            value={cardData.cvc}
            onChangeText={(text) => setCardData(p => ({ ...p, cvc: text }))}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Name on Card"
          value={cardData.name}
          onChangeText={(text) => setCardData(p => ({ ...p, name: text }))}
        />

        <Pressable style={styles.addButton} onPress={handleAddCard} disabled={isProcessing}>
          {isProcessing ? <Text>Adding...</Text> : <Text style={styles.addButtonText}>Add Card</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {},
  title: { fontFamily: 'Zaloga', fontSize: 28 },
  form: { padding: 16 },
  demoBanner: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  demoText: {
    fontSize: 14,
    fontFamily: 'Zaloga',
    color: '#856404',
    textAlign: 'center',
  },
  brandText: {
    fontSize: 13,
    fontFamily: 'Zaloga',
    color: '#6c757d',
    marginBottom: 12,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  row: { flexDirection: 'row', gap: 12 },
  addButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
