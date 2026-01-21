import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';
import { apiCall } from '../../src/lib/api';
import SwipeableRow from '../../src/components/SwipeableRow';
import { useFocusEffect } from 'expo-router';
import { useToastStore } from '../../src/state/toast';

export default function PaymentScreen() {
  const router = useCustomRouter();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const showToast = useToastStore((state) => state.showToast);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const methods = await apiCall('/api/payments/methods');
      setPaymentMethods(methods || []);
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
      showToast('Could not load payment methods.', 'error');
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      fetchPaymentMethods();
    }, [fetchPaymentMethods])
  );

  const handleDeletePayment = async (id: string) => {
    Alert.alert(
      'Delete Payment Method',
      'Are you sure you want to delete this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiCall(`/api/payments/methods/${id}`, { method: 'DELETE' });
              showToast('Payment method deleted.', 'success');
              fetchPaymentMethods(); // Refresh list
            } catch (error) {
              console.error('Failed to delete payment method:', error);
              showToast('Could not delete payment method.', 'error');
            }
          },
        },
      ]
    );
  };

  const handleSetDefaultPaymentMethod = async (id: string) => {
    try {
      await apiCall(`/api/payments/methods/${id}/default`, { method: 'PUT' });
      showToast('Default payment method updated.', 'success');
      fetchPaymentMethods(); // Refresh list
    } catch (error) {
      console.error('Failed to set default payment method:', error);
      showToast('Could not set default payment method.', 'error');
    }
  };

  const handleAddPayment = () => {
    router.push('/account/add-payment-method');
  };

  const getCardIcon = (brand: string) => {
    // Simple emoji mapping for card brands
    const lowerBrand = brand?.toLowerCase();
    if (lowerBrand === 'visa') return '🔵';
    if (lowerBrand === 'mastercard') return '🔴';
    if (lowerBrand === 'amex') return '⚪';
    return '💳';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {paymentMethods.length > 0 ? (
          paymentMethods.map(method => (
            <SwipeableRow key={method._id} onDelete={() => handleDeletePayment(method._id)}>
              <View style={styles.paymentCard}>
                <View style={styles.paymentHeader}>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentIcon}>{getCardIcon(method.brand)}</Text>
                    <View style={styles.paymentDetails}>
                      <Text style={styles.paymentBrand}>{method.brand} Card</Text>
                      <Text style={styles.cardNumber}>•••• {method.last4}</Text>
                    </View>
                  </View>
                  {method.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultText}>Default</Text>
                    </View>
                  )}
                </View>
                <View style={styles.paymentActions}>
                  {!method.isDefault && (
                    <Pressable
                      onPress={() => handleSetDefaultPaymentMethod(method._id)}
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionText}>Set as Default</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </SwipeableRow>
          ))
        ) : (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>No payment methods found.</Text>
            <Text style={styles.emptyStateSubText}>Add a new payment method to get started.</Text>
          </View>
        )}

        <Pressable onPress={handleAddPayment} style={styles.addButton}>
          <Text style={styles.addButtonText}>Add New Payment Method</Text>
        </Pressable>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  addButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 100,
    marginTop: 20,
    alignSelf: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Zaloga',
  },
  paymentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  paymentDetails: {},
  paymentBrand: {
    fontSize: 18,
    fontFamily: 'Zaloga',
    color: '#000000',
  },
  cardNumber: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    color: '#666666',
    marginTop: 2,
  },
  defaultBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  defaultText: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'Zaloga',
  },
  paymentActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  actionText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Zaloga',
  },
  bottomSpacing: {
    height: 100,
  },
  emptyStateContainer: {
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontFamily: 'Zaloga',
    fontSize: 18,
    color: '#333',
  },
  emptyStateSubText: {
    fontFamily: 'Zaloga',
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
});