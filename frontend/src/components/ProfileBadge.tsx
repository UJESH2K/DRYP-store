import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../state/auth';

export function ProfileBadge() {
  const { user, isAuthenticated } = useAuthStore();
  const insets = useSafeAreaInsets();

  const handlePress = () => {
    if (isAuthenticated) {
      router.push('/profile');
    } else {
      router.push('/login');
    }
  };

  return (
    <Pressable onPress={handlePress} style={[styles.container, { top: (insets.top || 12) + 8 }]}>
      <Text style={styles.icon}>
        {isAuthenticated && user ? 
          user.name?.charAt(0).toUpperCase() || 'U' : 
          '👤'
        }
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 48,
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  icon: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF6B6B',
  },
});