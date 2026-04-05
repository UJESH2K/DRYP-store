import React, { useState, useLayoutEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { apiCall } from '../../src/lib/api';
import { useToastStore } from '../../src/state/toast';
import { Ionicons } from '@expo/vector-icons';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';

export default function EditAddressScreen() {
  const router = useCustomRouter();
  const navigation = useNavigation();
  const { address: addressString } = useLocalSearchParams();
  
  const initialAddress = JSON.parse(addressString as string);
  const [address, setAddress] = useState({
    name: '',
    phone: '',
    company: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    country: '',
    type: 'Home',
    ...initialAddress,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  const handleEditAddress = async () => {
    const trimmedName = address.name.trim();
    if (!trimmedName || !address.line1.trim() || !address.city.trim() || !address.state.trim() || !address.country.trim()) {
      showToast('Please fill in all required text fields.', 'error');
      return;
    }
    if (!/^\d{10}$/.test(address.phone)) {
      showToast('Phone number must be exactly 10 digits.', 'error');
      return;
    }
    if (!/^\d{6}$/.test(address.pincode)) {
      showToast('Pincode must be exactly 6 digits.', 'error');
      return;
    }

    setIsProcessing(true);
    
    try {
      // 1. Fetch current profile to get the full array of addresses
      const profile = await apiCall('/api/users/profile');
      if (!profile || !profile.addresses) {
        throw new Error('Could not fetch current profile data.');
      }

      // 2. Map through and swap out only the edited address
      const updatedAddresses = profile.addresses.map((a: any) =>
        a._id === address._id ? address : a
      );

      // 3. Send the complete updated array back to the database
      const result = await apiCall('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ addresses: updatedAddresses }),
      });

      if (result) {
        showToast('Address updated successfully!', 'success');
        router.back(); // 4. Success! Navigate back to the list
      } else {
        throw new Error('Failed to update address.');
      }
    } catch (error: any) {
      console.error('Edit address error:', error);
      showToast(error?.data?.message || 'An unexpected error occurred.', 'error');
    } finally {
      setIsProcessing(false); // 5. ALWAYS stop the spinner, even on error!
    }
  };

  const handleDeleteAddress = () => {
    Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsProcessing(true); // Start spinner
          try {
            // 1. Fetch current profile
            const profile = await apiCall('/api/users/profile');
            if (!profile || !profile.addresses) {
              throw new Error('Could not fetch current profile data.');
            }

            // 2. Filter out the deleted address
            const updatedAddresses = profile.addresses.filter((a: any) => a._id !== address._id);

            // 3. Send the updated array to the database
            const result = await apiCall('/api/users/profile', {
              method: 'PUT',
              body: JSON.stringify({ addresses: updatedAddresses }),
            });

            if (result) {
              showToast('Address deleted successfully!', 'success');
              router.back(); // 4. Go back to the list
            } else {
              throw new Error('Failed to delete address.');
            }
          } catch (error: any) {
            console.error('Delete address error:', error);
            showToast(error?.data?.message || 'An unexpected error occurred.', 'error');
          } finally {
            setIsProcessing(false); // 5. Stop the spinner!
          }
        },
      },
    ]);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={handleDeleteAddress} disabled={isProcessing}>
          <Ionicons name="trash-outline" size={24} color="#f44336" />
        </Pressable>
      ),
    });
  }, [navigation, isProcessing, address]);


  const AddressTypeSelector = () => (
    <View style={styles.typeSelectorContainer}>
      {['Home', 'Work', 'Other'].map((type) => (
        <Pressable
          key={type}
          style={[
            styles.typeButton,
            address.type === type && styles.typeButtonSelected,
          ]}
          onPress={() => setAddress(p => ({ ...p, type }))}
        >
          <Text
            style={[
              styles.typeButtonText,
              address.type === type && styles.typeButtonTextSelected,
            ]}
          >
            {type}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.form}>
        <AddressTypeSelector />
        <TextInput
          style={styles.input}
          placeholder="Full Name*"
          value={address.name}
          onChangeText={(text) => setAddress(p => ({ ...p, name: text }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone Number*"
          value={address.phone}
          onChangeText={(text) => setAddress(p => ({ ...p, phone: text }))}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Company (Optional)"
          value={address.company}
          onChangeText={(text) => setAddress(p => ({ ...p, company: text }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Street Address*"
          value={address.line1}
          onChangeText={(text) => setAddress(p => ({ ...p, line1: text }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Apt, Suite, etc. (Optional)"
          value={address.line2}
          onChangeText={(text) => setAddress(p => ({ ...p, line2: text }))}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="City*"
            value={address.city}
            onChangeText={(text) => setAddress(p => ({ ...p, city: text }))}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="State*"
            value={address.state}
            onChangeText={(text) => setAddress(p => ({ ...p, state: text }))}
          />
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Pincode*"
            keyboardType="number-pad"
            value={address.pincode}
            onChangeText={(text) => setAddress(p => ({ ...p, pincode: text }))}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Country*"
            value={address.country}
            onChangeText={(text) => setAddress(p => ({ ...p, country: text }))}
          />
        </View>

        <Pressable style={styles.addButton} onPress={handleEditAddress} disabled={isProcessing}>
          {isProcessing ? <Text style={styles.addButtonText}>Saving...</Text> : <Text style={styles.addButtonText}>Save Address</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
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
    fontFamily: 'Zaloga',
  },
  row: { flexDirection: 'row', gap: 12 },
  addButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  addButtonText: { color: '#fff', fontSize: 18, fontFamily: 'Zaloga' },
  deleteButton: {
    backgroundColor: '#ff4d4f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  typeSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    backgroundColor: '#e9ecef',
    borderRadius: 12,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  typeButtonSelected: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  typeButtonText: {
    fontSize: 16,
    color: '#6c757d',
    fontFamily: 'Zaloga',
  },
  typeButtonTextSelected: {
    color: '#000',
    fontWeight: 'bold',
  },
});