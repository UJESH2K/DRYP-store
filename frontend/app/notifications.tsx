import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

// Mock data for notifications - replace with actual data fetching later
const mockNotifications = [
  { id: '1', type: 'new_arrival', title: 'New Arrival from Nike', message: 'Check out the latest Air Max series, just dropped!', time: '2 hours ago', read: false, link: '/(tabs)/home' },
  { id: '2', type: 'promo', title: 'Flash Sale: 50% Off!', message: 'Limited time offer on selected streetwear items. Ends midnight!', time: '1 day ago', read: false, link: '/(tabs)/search' },
  { id: '3', type: 'order', title: 'Order Shipped', message: 'Your order #DRYP12345 has been shipped and is on its way.', time: '2 days ago', read: true, link: '/account/orders' },
  { id: '4', type: 'recommendation', title: 'For You: Vintage Finds', message: 'Based on your likes, we found some vintage jackets for you.', time: '3 days ago', read: true, link: '/(tabs)/home' },
];

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState(mockNotifications);

  const getIconForType = (type: string) => {
    switch (type) {
      case 'new_arrival': return { name: 'sparkles-outline', color: '#5e5ce6' };
      case 'promo': return { name: 'pricetag-outline', color: '#ff9f0a' };
      case 'order': return { name: 'cube-outline', color: '#32ade6' };
      case 'recommendation': return { name: 'heart-outline', color: '#ff4f79' };
      default: return { name: 'notifications-outline', color: '#8e8e93' };
    }
  };

  const renderItem = ({ item }: { item: typeof mockNotifications[0] }) => {
    const icon = getIconForType(item.type);
    return (
      <Pressable style={[styles.notificationItem, !item.read && styles.unreadItem]} onPress={() => item.link && router.push(item.link)}>
        <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
          <Ionicons name={icon.name as any} size={24} color={icon.color} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationMessage}>{item.message}</Text>
          <Text style={styles.notificationTime}>{item.time}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>No Notifications Yet</Text>
            <Text style={styles.emptySubtitle}>Important updates and offers will appear here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  listContainer: {
    // paddingVertical: 8, // Removed to reduce space between header and first item
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  unreadItem: {
    backgroundColor: '#f8f9fa',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 17,
    fontFamily: 'Zaloga',
    color: '#000',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 15,
    fontFamily: 'Zaloga',
    color: '#6c757d',
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 13,
    fontFamily: 'Zaloga',
    color: '#adb5bd',
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007bff',
    marginLeft: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: '50%',
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'Zaloga',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    color: '#6c757d',
    textAlign: 'center',
  },
});