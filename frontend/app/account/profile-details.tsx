import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { useCustomRouter } from '@/hooks/useCustomRouter';
import { useAuthStore } from '@/state/auth';
import { apiCall } from '@/lib/api';
import { useToastStore } from '@/state/toast';
import { Ionicons } from '@expo/vector-icons';

const Row = ({ children, isFirst, isLast }: { children: React.ReactNode; isFirst?: boolean; isLast?: boolean }) => (
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

export default function ProfileDetailsScreen() {
  const router = useCustomRouter();
  const navigation = useNavigation();
  const { user, updateUser } = useAuthStore();
  const { showToast } = useToastStore();

  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const handleSaveChanges = async () => {
    if (isLoading) return;
    if (!name.trim()) {
      showToast('Name cannot be empty.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiCall('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });

      if (result) {
        updateUser({ ...user!, name: name.trim(), phone: phone.trim() });
        showToast('Profile updated successfully.', 'success');
        router.back();
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast(error.message || 'Could not update profile. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
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
  }, [navigation, isLoading, name, phone]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Section header="Personal Information">
          <Row isFirst>
            <Text style={styles.rowLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
            />
          </Row>
          <Row>
            <Text style={styles.rowLabel}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={email}
              editable={false}
              placeholder="Email cannot be changed"
            />
          </Row>
          <Row isLast>
            <Text style={styles.rowLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
            />
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
    width: 100,
  },
  input: {
    flex: 1,
    fontFamily: 'Zaloga',
    fontSize: 17,
    color: '#000000',
    textAlign: 'right',
    paddingRight: 16,
  },
  inputDisabled: {
    color: '#8e8e93',
  },
});