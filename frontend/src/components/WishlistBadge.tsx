import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useWishlistStore } from '../state/wishlist';

export function WishlistBadge() {
  const { items } = useWishlistStore();
  const insets = useSafeAreaInsets();

  const handlePress = () => {
    router.push('/wishlist');
  };

  return (
    <Pressable onPress={handlePress} style={[styles.container, { top: (insets.top || 12) + 8 }]}>
      <Text style={styles.icon}>♡</Text>
      {items.length > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {items.length > 99 ? '99+' : items.length}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
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
    fontSize: 20,
    color: '#FF8A80',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});