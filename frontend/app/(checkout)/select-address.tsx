import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import SwipeableRow from '../../src/components/SwipeableRow';
import { apiCall } from '../../src/lib/api';
import { useToastStore } from '../../src/state/toast';

export default function SelectAddressScreen() {
  const router = useCustomRouter();
  const params = useLocalSearchParams();
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const showToast = useToastStore((state) => state.showToast);

  // 1. Fetch addresses from the API when the screen opens
  useEffect(() => {
    const fetchAddresses = async () => {
      try {
        const profile = await apiCall('/api/users/profile');
        if (profile && profile.addresses) {
          setAddresses(profile.addresses);
        }
      } catch (error) {
        console.error('Failed to fetch addresses:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAddresses();
  }, []);

  // 2. Listen for newly added addresses
  useEffect(() => {
    if (params.newAddress) {
      const newAddr = JSON.parse(params.newAddress as string);
      setAddresses(prev => [...prev, newAddr]);
      setSelectedAddress(newAddr); // Auto-select the newly added address
    }
  }, [params.newAddress]);

  const handleSelectAddress = () => {
    if (selectedAddress) {
      router.replace({
        pathname: '/(checkout)/checkout', // Verify this matches your checkout file path!
        params: { selectedAddress: JSON.stringify(selectedAddress) }
      });
    } else {
      router.back();
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      const updatedAddresses = addresses.filter(a => a._id !== addressId);
      const result = await apiCall('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ addresses: updatedAddresses }),
      });

      if (result) {
        showToast('Address deleted successfully!', 'success');
        setAddresses(updatedAddresses);
        if (selectedAddress?._id === addressId) {
          setSelectedAddress(null);
        }
      } else {
        throw new Error('Failed to delete address.');
      }
    } catch (error: any) {
      console.error('Delete address error:', error);
      const errorMessage = error?.data?.message || 'An unexpected error occurred.';
      showToast(errorMessage, 'error');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.title}>Select Address</Text>
        <View style={{flexDirection: 'row'}}>
          <Pressable onPress={() => router.push('/(checkout)/add-address')}>
            <Ionicons name="add" size={24} color="#007bff" />
          </Pressable>
          <Pressable onPress={handleSelectAddress} style={{marginLeft: 15}}>
            <Text style={styles.selectButton}>Select</Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : (
        <FlatList
          data={addresses}
          renderItem={({ item }) => (
            <SwipeableRow onDelete={() => handleDeleteAddress(item._id)}>
              <Pressable
                style={[
                  styles.addressContainer,
                  selectedAddress?._id === item._id && styles.selectedAddress,
                ]}
                onPress={() => setSelectedAddress(item)}
              >
                <Text style={[styles.addressText, { fontWeight: 'bold' }]}>{item.name}</Text>
                <Text style={styles.addressText}>{item.line1 || item.street}</Text>
                <Text style={styles.addressText}>{item.city}, {item.state} {item.pincode || item.zipCode}</Text>
                <Text style={styles.addressText}>{item.country}</Text>
              </Pressable>
            </SwipeableRow>
          )}
          keyExtractor={(item) => item._id}
        />
      )}
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
  title: { fontSize: 20, fontFamily: 'JosefinSans_600SemiBold' },
  selectButton: { fontSize: 16, color: '#007bff', fontFamily: 'JosefinSans_600SemiBold' },
  addressContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  selectedAddress: {
    backgroundColor: '#e6f2ff',
  },
  addressText: {
    fontSize: 16,
    marginBottom: 4,
    fontFamily: 'JosefinSans_400Regular',
  },
});