
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function Header() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>DRYP</Text>
      <View style={styles.headerIcons}>
        <Pressable onPress={() => router.push('/liked-items')}>
          <Ionicons name="heart-outline" size={28} color="#000" />
        </Pressable>
        <Pressable onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications-outline" size={28} color="#000" />
        </Pressable>
      </View>
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
  headerIcons: {
    flexDirection: 'row',
    gap: 16,
  },
});
