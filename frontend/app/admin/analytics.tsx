import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AnalyticsScreen() {
  // Placeholder KPIs; in a real app, fetch from backend
  const metrics = [
    { label: 'Daily Active Users', value: '1,245' },
    { label: 'Total Swipes Today', value: '18,430' },
    { label: 'Likes', value: '7,912' },
    { label: 'Dislikes', value: '6,104' },
    { label: 'Cart Adds', value: '1,386' },
    { label: 'Checkout Starts', value: '312' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Engagement Analytics</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {metrics.map((m, idx) => (
          <View key={idx} style={styles.kpi}>
            <Text style={styles.kpiValue}>{m.value}</Text>
            <Text style={styles.kpiLabel}>{m.label}</Text>
          </View>
        ))}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Tags</Text>
          <Text style={styles.blurb}>casual, hoodie, denim, formal, accessories</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conversion Funnel</Text>
          <Text style={styles.blurb}>View → Swipe → Like → Cart → Checkout</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  content: { padding: 16 },
  kpi: { padding: 16, borderRadius: 12, backgroundColor: '#fafafa', marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  kpiValue: { fontSize: 22, fontWeight: '700', color: '#FF6B6B' },
  kpiLabel: { fontSize: 12, color: '#666' },
  section: { marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  blurb: { fontSize: 13, color: '#666', marginTop: 6 },
});