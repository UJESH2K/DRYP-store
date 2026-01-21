import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TextTicker from 'react-native-text-ticker';
import { useAuthStore } from '../src/state/auth';
import { apiCall } from '../src/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VendorHeader } from '../src/components/vendor/Header';
import { useCustomRouter } from '../src/hooks/useCustomRouter';

export default function VendorRegisterScreen() {
  const router = useCustomRouter();
  const { user, token, ...authActions } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  // User details
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Vendor details
  const [vendorName, setVendorName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');

  // Address details
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('');

  const handleRegister = async () => {
    setIsLoading(true);
    try {
      const vendorData = {
        ownerName,
        email,
        password,
        vendorName,
        description,
        phone,
        website,
        address: { street, city, state, zipCode, country },
      };

      const response = await apiCall('/api/vendors/register', {
        method: 'POST',
        body: JSON.stringify(vendorData),
      });

      if (response && response.token) {
        const { token, user } = response;
        authActions.updateUser(user);
        await AsyncStorage.setItem('user_token', token);
        await AsyncStorage.setItem('user_data', JSON.stringify(user));
        Alert.alert('Success', 'Vendor account created successfully!', [
          { text: 'OK', onPress: () => router.replace('/(vendor-tabs)/products') },
        ]);
      } else {
        throw new Error(response?.message || 'Failed to register vendor');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    Alert.alert('Coming Soon', `Login with ${provider} is not available yet.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <VendorHeader title="Become a Vendor" />
        <TextTicker
          style={styles.marqueeText}
          duration={15000}
          loop
          repeatSpacer={50}
          marqueeDelay={1000}
        >
          STREETWEAR • MODERN ESSENTIALS • HANDCRAFT • PREMIUM
        </TextTicker>
        <View style={styles.header}>
          <Text style={styles.subtitle}>Create your storefront on DR-YP</Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Your Account</Text>
          <TextInput style={styles.input} placeholder="Your Full Name" value={ownerName} onChangeText={setOwnerName} />
          <TextInput style={styles.input} placeholder="Your Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Your Business</Text>
          <TextInput style={styles.input} placeholder="Business Name" value={vendorName} onChangeText={setVendorName} />
          <TextInput style={styles.input} placeholder="Business Description" value={description} onChangeText={setDescription} multiline />
          <TextInput style={styles.input} placeholder="Business Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder="Website (Optional)" value={website} onChangeText={setWebsite} autoCapitalize="none" />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Business Address</Text>
          <TextInput style={styles.input} placeholder="Street Address" value={street} onChangeText={setStreet} />
          <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />
          <TextInput style={styles.input} placeholder="State / Province" value={state} onChangeText={setState} />
          <TextInput style={styles.input} placeholder="ZIP / Postal Code" value={zipCode} onChangeText={setZipCode} />
          <TextInput style={styles.input} placeholder="Country" value={country} onChangeText={setCountry} />
        </View>

        <Pressable style={[styles.registerButton, isLoading && styles.disabledButton]} onPress={handleRegister} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.registerButtonText}>Create Vendor Account</Text>
          )}
        </Pressable>
        
        <View style={styles.socialLoginContainer}>
          <View style={styles.separator}>
            <Text style={styles.separatorText}>OR</Text>
          </View>
          <Pressable style={styles.socialButton} onPress={() => handleSocialLogin('Google')}>
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </Pressable>
          <Pressable style={styles.socialButton} onPress={() => handleSocialLogin('Apple')}>
            <Text style={styles.socialButtonText}>Continue with Apple</Text>
          </Pressable>
        </View>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to Login</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scrollContent: { padding: 24 },
  header: { alignItems: 'center', marginBottom: 24 },
  marqueeText: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    color: '#666666',
    textAlign: 'center',
    marginVertical: 10,
  },
  subtitle: { fontSize: 16, color: '#666666', marginTop: 4, fontFamily: 'Zaloga' },
  formSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontFamily: 'Zaloga', color: '#1a1a1a', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    fontFamily: 'Zaloga',
  },
  registerButton: {
    backgroundColor: '#FF6B6B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Zaloga',
  },
  disabledButton: { backgroundColor: '#cccccc' },
  backButton: { marginTop: 16, alignItems: 'center' },
  backButtonText: { color: '#666666', fontFamily: 'Zaloga' },
  socialLoginContainer: {
    marginVertical: 20,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  separatorText: {
    fontFamily: 'Zaloga',
    color: '#666666',
    paddingHorizontal: 10,
  },
  socialButton: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  socialButtonText: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    color: '#1a1a1a',
  },
});
