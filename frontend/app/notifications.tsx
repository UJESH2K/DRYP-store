import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.emptyContainer}>
        <Ionicons name="notifications-off-outline" size={80} color="#ccc" />
        <Text style={styles.emptyTitle}>No notifications yet</Text>
        <Text style={styles.emptySubtitle}>Important updates and offers will appear here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F2E9',
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