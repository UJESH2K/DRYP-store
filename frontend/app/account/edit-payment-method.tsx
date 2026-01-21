import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { apiCall } from '../../src/lib/api';
import { useToastStore } from '../../src/state/toast';
import { Ionicons } from '@expo/vector-icons';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';

export default function EditPaymentMethodScreen() {
  const router = useCustomRouter();
  const { paymentMethod: paymentMethodString } = useLocalSearchParams();
  const [paymentMethod, setPaymentMethod] = useState(JSON.parse(paymentMethodString as string));
  const [isProcessing, setIsProcessing] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  const handleEditPaymentMethod = async () => {
    if (!paymentMethod.brand || !paymentMethod.last4) {
      showToast('Please fill in all fields.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const profile = await apiCall('/api/users/profile');
      const existingPaymentMethods = profile.paymentMethods || [];
      const updatedPaymentMethods = existingPaymentMethods.map(p => p._id === paymentMethod._id ? paymentMethod : p);

      const result = await apiCall('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({
          paymentMethods: updatedPaymentMethods,
        }),
      });

      if (result) {
        showToast('Payment method updated successfully!', 'success');
        router.back();
      } else {
        throw new Error('Failed to update payment method.');
      }
    } catch (error: any) {
      console.error('Update payment method error:', error);
      const errorMessage = error?.data?.message || 'An unexpected error occurred.';
      showToast(errorMessage, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePaymentMethod = async () => {
    Alert.alert('Delete Payment Method', 'Are you sure you want to delete this payment method?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsProcessing(true);
          try {
            const profile = await apiCall('/api/users/profile');
            const existingPaymentMethods = profile.paymentMethods || [];
            const updatedPaymentMethods = existingPaymentMethods.filter(p => p._id !== paymentMethod._id);

            const result = await apiCall('/api/users/profile', {
              method: 'PUT',
              body: JSON.stringify({
                paymentMethods: updatedPaymentMethods,
              }),
            });

            if (result) {
              showToast('Payment method deleted successfully!', 'success');
              router.back();
            } else {
              throw new Error('Failed to delete payment method.');
            }
          } catch (error: any) {
            console.error('Delete payment method error:', error);
            const errorMessage = error?.data?.message || 'An unexpected error occurred.';
            showToast(errorMessage, 'error');
          } finally {
            setIsProcessing(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.title}>Edit Payment Method</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Brand"
          value={paymentMethod.brand}
          onChangeText={(text) => setPaymentMethod(p => ({ ...p, brand: text }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Last 4 Digits"
          value={paymentMethod.last4}
          onChangeText={(text) => setPaymentMethod(p => ({ ...p, last4: text }))}
          keyboardType="number-pad"
          maxLength={4}
        />

        <Pressable style={styles.saveButton} onPress={handleEditPaymentMethod} disabled={isProcessing}>
          {isProcessing ? <Text>Saving...</Text> : <Text style={styles.saveButtonText}>Save</Text>}
        </Pressable>

        <Pressable style={styles.deleteButton} onPress={handleDeletePaymentMethod} disabled={isProcessing}>
          <Text style={styles.deleteButtonText}>Delete</Text>
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
  title: { fontSize: 20, fontWeight: 'bold' },
  form: { padding: 16 },
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
  saveButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteButton: {
    backgroundColor: '#ff4d4f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
