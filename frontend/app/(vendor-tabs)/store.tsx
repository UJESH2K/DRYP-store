import React, { useState, useCallback, useEffect } from 'react';
import { normalizeShopDomain } from '@/lib/shopify';
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
import * as WebBrowser from 'expo-web-browser';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';
import { VendorHeader } from '../../src/components/vendor/Header';
import { useAuthStore } from '../../src/state/auth';
import { apiCall } from '../../src/lib/api';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.9:5000';

export default function StoreProfileScreen() {
  const { user, token, logout } = useAuthStore();
  const [vendor, setVendor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [shopifyStatus, setShopifyStatus] = useState(null);
  const [showShopifyInput, setShowShopifyInput] = useState(false);
  const [shopDomain, setShopDomain] = useState('');
  const [shopifyError, setShopifyError] = useState('');
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

  const fetchShopifyStatus = useCallback(async () => {
    if (user?.role !== 'vendor') return;
    const data = await apiCall('/api/vendors/me/shopify-import');
    if (data && !data.message) setShopifyStatus(data);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchShopifyStatus();
    }, [fetchShopifyStatus])
  );

  useEffect(() => {
    const importStatus = shopifyStatus?.shopify?.importStatus;
    if (importStatus === 'pending' || importStatus === 'importing') {
      const interval = setInterval(fetchShopifyStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [shopifyStatus?.shopify?.importStatus, fetchShopifyStatus]);

  const handleShopifyConnect = async () => {
    if (!token) return;
    const domain = normalizeShopDomain(shopDomain);
    if (!domain) {
      setShopifyError('Enter a valid Shopify domain, e.g. your-store.myshopify.com');
      return;
    }
    const startUrl = `${API_BASE_URL}/api/auth/shopify/start?shop=${encodeURIComponent(domain)}&platform=mobile&token=${encodeURIComponent(token)}`;
    await WebBrowser.openAuthSessionAsync(startUrl, 'dryp://oauth-callback');
  };

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

            <View style={styles.shopifySection}>
              <Text style={styles.subTitle}>Shopify Integration</Text>
              {(!shopifyStatus?.shopify?.importStatus || shopifyStatus.shopify.importStatus === 'not_connected') ? (
                showShopifyInput ? (
                  <View style={styles.shopifyInputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder="your-store.myshopify.com"
                      value={shopDomain}
                      onChangeText={(text) => {
                        setShopDomain(text);
                        setShopifyError('');
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable
                      style={[styles.saveButton, !shopDomain.trim() && styles.disabledButton]}
                      onPress={handleShopifyConnect}
                      disabled={!shopDomain.trim()}
                    >
                      <Text style={styles.saveButtonText}>Connect Store</Text>
                    </Pressable>
                  </View>
                  {shopifyError ? <Text style={styles.errorText}>{shopifyError}</Text> : null}
                ) : (
                  <Pressable style={styles.saveButton} onPress={() => setShowShopifyInput(true)}>
                    <Text style={styles.saveButtonText}>Connect Shopify Store</Text>
                  </Pressable>
                )
              ) : (
                <View style={styles.shopifyStatusBox}>
                  <Text style={styles.infoText}>{shopifyStatus.shopify.shopDomain}</Text>
                  <Text style={styles.shopifyStatusBadge}>
                    {shopifyStatus.shopify.importStatus === 'completed'
                      ? `Synced — ${shopifyStatus.import?.productsImported ?? 0} products`
                      : shopifyStatus.shopify.importStatus === 'failed'
                        ? `Import Failed: ${shopifyStatus.import?.error || shopifyStatus.shopify.importError || ''}`
                        : shopifyStatus.shopify.importStatus === 'importing'
                          ? 'Importing…'
                          : 'Queued'}
                  </Text>
                </View>
              )}
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
  shopifySection: {
    width: '100%',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  shopifyInputRow: {
    width: '100%',
  },
  shopifyStatusBox: {
    alignItems: 'center',
  },
  shopifyStatusBadge: {
    marginTop: 8,
    fontSize: 14,
    color: '#555',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    fontFamily: 'Zaloga',
    marginTop: -4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});