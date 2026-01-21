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
import { useFocusEffect } from 'expo-router';

export default function AddressesScreen() {
  const router = useCustomRouter();
  const [addresses, setAddresses] = useState([]);

  useFocusEffect(
    useCallback(() => {
      const fetchAddresses = async () => {
        try {
          const profile = await apiCall('/api/users/profile');
          if (profile && profile.addresses) {
            setAddresses(profile.addresses);
          }
        } catch (error) {
          console.error('Failed to fetch addresses:', error);
        }
      };

      fetchAddresses();
    }, [])
  );



  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      const updatedAddresses = addresses.map(a => ({
        ...a,
        isDefault: a._id === addressId,
      }));

      const result = await apiCall('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ addresses: updatedAddresses }),
      });

      if (result) {
        setAddresses(updatedAddresses);
      } else {
        throw new Error('Failed to set default address.');
      }
    } catch (error) {
      console.error('Set default address error:', error);
    }
  };

  const handleEditAddress = (address) => {
    router.push({ pathname: '/account/edit-address', params: { address: JSON.stringify(address) } });
  }

  const handleDeleteAddress = (addressId: string) => {
    Alert.alert('Delete Address', `Delete address ${addressId}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const updatedAddresses = addresses.filter(a => a._id !== addressId);
          const result = await apiCall('/api/users/profile', {
            method: 'PUT',
            body: JSON.stringify({ addresses: updatedAddresses }),
          });

          if (result) {
            setAddresses(updatedAddresses);
          } else {
            throw new Error('Failed to delete address.');
          }
        } catch (error) {
          console.error('Delete address error:', error);
        }
      }},
    ])
  }

  const handleAddAddress = () => {
    router.push('/account/add-address');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {addresses.map((address) => (
          <View key={address._id} style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <View style={styles.addressTypeContainer}>
                <Text style={styles.addressType}>{address.type}</Text>
                {address.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>Default</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.addressActions}>
                {!address.isDefault && (
                  <Pressable
                    onPress={() => handleSetDefaultAddress(address._id)}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionText}>Set as Default</Text>
                  </Pressable>
                )}
                <Pressable 
                  onPress={() => handleEditAddress(address)}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                <Pressable 
                  onPress={() => handleDeleteAddress(address._id)}
                  style={[styles.actionButton, styles.deleteButton]}
                >
                  <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                </Pressable>
              </View>
            </View>
            
            <View style={styles.addressDetails}>
              <Text style={styles.addressName}>{address.name}</Text>
              {address.company && <Text style={styles.addressLine}>{address.company}</Text>}
              <Text style={styles.addressLine}>{address.line1}</Text>
              {address.line2 && <Text style={styles.addressLine}>{address.line2}</Text>}
              <Text style={styles.addressLine}>
                {`${address.city}, ${address.state} ${address.pincode}`}
              </Text>
              <Text style={styles.addressLine}>{address.country}</Text>
              {address.phone && <Text style={styles.addressPhone}>T: {address.phone}</Text>}
            </View>
          </View>
        ))}
        
        <Pressable onPress={handleAddAddress} style={styles.addButton}>
          <Text style={styles.addButtonText}>Add New Address</Text>
        </Pressable>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 5,
  },
  backText: {
    fontSize: 28,
    color: '#000000',
    fontFamily: 'Zaloga',
  },
  headerTitle: {
    fontSize: 28,
    color: '#000000',
    fontFamily: 'Zaloga',
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  addressCard: {
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
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressType: {
    fontSize: 18,
    color: '#000000',
    marginRight: 8,
    fontFamily: 'Zaloga',
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
  addressActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  deleteButton: {
    backgroundColor: '#ffebee',
  },
  actionText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Zaloga',
  },
  deleteText: {
    color: '#f44336',
  },
  addressName: {
    fontSize: 18,
    color: '#000000',
    marginBottom: 4,
    fontFamily: 'Zaloga',
  },
  addressLine: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 2,
    fontFamily: 'Zaloga',
  },
  addressPhone: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
    fontFamily: 'Zaloga',
  },
  bottomSpacing: {
    height: 100,
  },
})
