
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../state/auth';
import { useCustomRouter } from '../../hooks/useCustomRouter';

export function VendorHeader({ title }: { title: string }) {
  const { logout } = useAuthStore();
  const router = useCustomRouter();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      <Pressable onPress={handleLogout} style={styles.logoutButton}>
        <Ionicons name="log-out-outline" size={28} color="#000" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 28,
    color: '#000',
    letterSpacing: 1.5,
    fontFamily: 'Zaloga',
  },
  logoutButton: {
    padding: 8,
  },
});
