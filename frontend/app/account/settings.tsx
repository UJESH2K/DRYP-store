import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { useCustomRouter } from '@/hooks/useCustomRouter';
import { useAuthStore } from '@/state/auth';
import { useSettingsStore } from '@/state/settings';
import { apiCall } from '@/lib/api';
import { useToastStore } from '@/state/toast';
import SingleSelectDropdown from '@/components/SingleSelectDropdown';
import { Ionicons } from '@expo/vector-icons';

const countryCurrencyOptions = [
  { label: '🇮🇳 India (INR)', value: 'INR' },
  { label: '🇺🇸 United States (USD)', value: 'USD' },
  { label: '🇪🇺 Europe (EUR)', value: 'EUR' },
  { label: '🇬🇧 United Kingdom (GBP)', value: 'GBP' },
  { label: '🇯🇵 Japan (JPY)', value: 'JPY' },
  { label: '🇨🇦 Canada (CAD)', value: 'CAD' },
  { label: '🇦🇺 Australia (AUD)', value: 'AUD' },
];

const Row = ({ children, isFirst, isLast }) => (
  <View 
    style={[
      styles.row, 
      isFirst && styles.rowFirst, 
      isLast && styles.rowLast
    ]}
  >
    {children}
  </View>
);

const Section = ({ header, children }) => (
  <View style={styles.sectionContainer}>
    {header && <Text style={styles.sectionHeader}>{header.toUpperCase()}</Text>}
    <View style={styles.sectionBody}>
      {children}
    </View>
  </View>
);

export default function SettingsScreen() {
  const router = useCustomRouter();
  const navigation = useNavigation();
  const { user, updateUser, logout } = useAuthStore();
  const { currency, setCurrency } = useSettingsStore();
  const { showToast } = useToastStore();
  
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(user?.preferences?.currency || currency);
  const [notificationSettings, setNotificationSettings] = useState(
    user?.preferences?.notificationSettings || {
      orderUpdates: true,
      promotions: false,
      newItemAlerts: false,
    }
  );

  // Delete account modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveChanges = async () => {
    // ... (logic remains the same)
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={handleSaveChanges} disabled={isLoading}>
          {isLoading 
            ? <ActivityIndicator color="#1a1a1a" /> 
            : <Text style={styles.headerSaveButton}>Save</Text>
          }
        </Pressable>
      ),
    });
  }, [navigation, isLoading, selectedCurrency, notificationSettings]);

  const handleNotificationChange = (key, value) => {
    setNotificationSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleDeleteAccount = async () => {
    if (!password) {
      showToast('Please enter your password to confirm account deletion.', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      const result = await apiCall('/api/users/me', {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      });

      if (result && result.message === 'Account deleted successfully') {
        showToast('Account deleted successfully.');
        await logout();
        router.replace('/login');
      } else {
        throw new Error(result.message || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error.message);
      showToast(error.message, 'error');
    } finally {
      setIsDeleting(false);
      setDeleteModalVisible(false);
      setPassword('');
    }
  };

  const DeleteAccountModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={deleteModalVisible}
      onRequestClose={() => setDeleteModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Delete Account</Text>
          <Text style={styles.modalMessage}>
            Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently lost.
          </Text>
          <Text style={styles.modalPasswordPrompt}>Enter your password to confirm:</Text>
          <TextInput
            style={styles.modalTextInput}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholderTextColor="#999999"
          />
          <View style={styles.modalButtonContainer}>
            <Pressable 
              style={[styles.modalCancelButton, { backgroundColor: '#F0F0F0' }]}
              onPress={() => {
                setDeleteModalVisible(false);
                setPassword('');
              }}
              disabled={isDeleting}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable 
              style={[styles.modalDeleteButton, isDeleting && { opacity: 0.6 }]}
              onPress={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalDeleteButtonText}>Delete</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <DeleteAccountModal />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Section header="General">
          <Row isFirst isLast>
            <Text style={styles.rowLabel}>Currency</Text>
            <SingleSelectDropdown
              options={countryCurrencyOptions}
              selectedValue={selectedCurrency}
              onSelectionChange={setSelectedCurrency}
            />
          </Row>
        </Section>
        
        <Section header="Notifications">
          <Row isFirst>
            <Text style={styles.rowLabel}>Order Updates</Text>
            <Switch
              value={notificationSettings.orderUpdates}
              onValueChange={(v) => handleNotificationChange('orderUpdates', v)}
              trackColor={{ false: '#767577', true: '#1a1a1a' }}
              thumbColor={'#ffffff'}
            />
          </Row>
          <Row>
            <Text style={styles.rowLabel}>Promotions</Text>
            <Switch
              value={notificationSettings.promotions}
              onValueChange={(v) => handleNotificationChange('promotions', v)}
              trackColor={{ false: '#767577', true: '#1a1a1a' }}
              thumbColor={'#ffffff'}
            />
          </Row>
          <Row isLast>
            <Text style={styles.rowLabel}>New Item Alerts</Text>
            <Switch
              value={notificationSettings.newItemAlerts}
              onValueChange={(v) => handleNotificationChange('newItemAlerts', v)}
              trackColor={{ false: '#767577', true: '#1a1a1a' }}
              thumbColor={'#ffffff'}
            />
          </Row>
        </Section>

        <Section header="Account">
          <Row isFirst>
            <Pressable style={styles.fullWidthPressable} onPress={() => router.push('/account/change-password')}>
              <Text style={styles.rowLabel}>Change Password</Text>
              <Ionicons name="chevron-forward" size={20} color="#6c757d" />
            </Pressable>
          </Row>
          <Row isLast>
            <Pressable style={styles.fullWidthPressable} onPress={() => setDeleteModalVisible(true)}>
              <Text style={[styles.rowLabel, styles.deleteAccountText]}>Delete Account</Text>
            </Pressable>
          </Row>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  headerSaveButton: {
    fontFamily: 'Zaloga',
    fontSize: 18,
    color: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
  },
  sectionContainer: {
    marginTop: 35,
    marginHorizontal: 16,
  },
  sectionHeader: {
    fontFamily: 'Zaloga',
    fontSize: 14,
    color: '#6c757d',
    paddingLeft: 16,
    marginBottom: 8,
  },
  sectionBody: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#cccccc',
  },
  rowFirst: {},
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontFamily: 'Zaloga',
    fontSize: 17,
    color: '#000000',
  },
  fullWidthPressable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  deleteAccountText: {
    color: '#FF3B30',
  },
  // ... (Modal styles can be kept but should be checked for font consistency)
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'Zaloga',
    color: '#333333',
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalPasswordPrompt: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    color: '#333333',
    marginBottom: 10,
  },
  modalTextInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Zaloga',
    marginBottom: 20,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#f0f0f0',
  },
  modalCancelButtonText: {
    fontSize: 18,
    fontFamily: 'Zaloga',
    color: '#333333',
  },
  modalDeleteButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 10,
  },
  modalDeleteButtonText: {
    fontSize: 18,
    fontFamily: 'Zaloga',
    color: '#FFFFFF',
  },
});