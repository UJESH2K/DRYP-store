import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function AdminHome() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Styl Admin</Text>
        <Text style={styles.subtitle}>Operations & Insights</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <Pressable style={styles.card} onPress={() => router.push('/admin/analytics')}>
          <Text style={styles.cardTitle}>Engagement Analytics</Text>
          <Text style={styles.cardSub}>DAU, swipes, likes, CTR, cart adds</Text>
        </Pressable>
        <Pressable style={styles.card} onPress={() => router.push('/admin/feed-health')}>
          <Text style={styles.cardTitle}>Feed Health</Text>
          <Text style={styles.cardSub}>Broken links, stock sync, image status</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  card: { padding: 16, margin: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  cardSub: { fontSize: 13, color: '#666', marginTop: 4 },
});