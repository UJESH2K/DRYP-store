import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';
import { VendorHeader } from '../../src/components/vendor/Header';
import { useAuthStore } from '../../src/state/auth';
import { apiCall } from '../../src/lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function StoreProfileScreen() {
  const { user, logout } = useAuthStore();
  const [vendor, setVendor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const router = useCustomRouter();

  const fetchVendorProfile = useCallback(async () => {
    if (user?.role !== 'vendor') return;
    setIsLoading(true);
    try {
      const data = await apiCall('/api/vendors/me');
      if (data && !data.message) {
        setVendor(data);
        setFormData(data);
      } else {
        throw new Error(data.message || 'Failed to fetch store profile');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchVendorProfile();
    }, [fetchVendorProfile])
  );

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleAddressChange = (field, value) => {
    setFormData(prev => ({ ...prev, address: { ...prev.address, [field]: value } }));
  };

  const handleSaveChanges = async () => {
    setIsLoading(true);
    try {
      const updatedVendor = await apiCall('/api/vendors/me', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      if (updatedVendor && !updatedVendor.message) {
        setVendor(updatedVendor);
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully!');
      } else {
        throw new Error(updatedVendor.message || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  if (isLoading && !vendor) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" style={styles.centered} />
      </SafeAreaView>
    );
  }

  if (!vendor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text>Could not load your store profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <VendorHeader title={isEditing ? 'Edit Profile' : 'Store Profile'} />
      <ScrollView contentContainerStyle={styles.content}>
        {isEditing ? (
          // EDITING VIEW
          <View style={styles.form}>
            <Text style={styles.label}>Store Name</Text>
            <TextInput style={styles.input} value={formData.name} onChangeText={(v) => handleInputChange('name', v)} />
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} value={formData.description} onChangeText={(v) => handleInputChange('description', v)} multiline />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={formData.phone} onChangeText={(v) => handleInputChange('phone', v)} keyboardType="phone-pad" />
            <Text style={styles.label}>Website</Text>
            <TextInput style={styles.input} value={formData.website} onChangeText={(v) => handleInputChange('website', v)} keyboardType="url" />

            <Text style={styles.subTitle}>Address</Text>
            <TextInput style={styles.input} placeholder="Street" value={formData.address?.street} onChangeText={(v) => handleAddressChange('street', v)} />
            <TextInput style={styles.input} placeholder="City" value={formData.address?.city} onChangeText={(v) => handleAddressChange('city', v)} />
            <TextInput style={styles.input} placeholder="State" value={formData.address?.state} onChangeText={(v) => handleAddressChange('state', v)} />
            <TextInput style={styles.input} placeholder="ZIP Code" value={formData.address?.zipCode} onChangeText={(v) => handleAddressChange('zipCode', v)} />
            <TextInput style={styles.input} placeholder="Country" value={formData.address?.country} onChangeText={(v) => handleAddressChange('country', v)} />

            <Pressable style={styles.saveButton} onPress={handleSaveChanges} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </Pressable>
          </View>
        ) : (
          // DISPLAY VIEW
          <View style={styles.profileDetails}>
            <Image
              style={styles.logo}
              source={vendor.logo ? { uri: vendor.logo } : require('../../assets/casa_denim.jpg')}
            />
            <Text style={styles.vendorName}>{vendor.name}</Text>
            <Text style={styles.vendorDescription}>{vendor.description}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color="#555" />
              <Text style={styles.infoText}>{vendor.phone}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="globe-outline" size={20} color="#555" />
              <Text style={styles.infoText}>{vendor.website}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#555" />
              <Text style={styles.infoText}>{`${vendor.address.street}, ${vendor.address.city}, ${vendor.address.state}`}</Text>
            </View>
          </View>
        )}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="white" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  editButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 8,
  },
  content: { padding: 20 },
  profileDetails: { alignItems: 'center' },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
    backgroundColor: '#e0e0e0',
  },
  vendorName: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  vendorDescription: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 24 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  infoText: { fontSize: 16, marginLeft: 12 },
  form: { paddingBottom: 50 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#333' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  subTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
  },
  saveButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc3545', // Red color for logout
    padding: 12,
    borderRadius: 8,
    marginTop: 30,
    width: '80%',
    alignSelf: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});