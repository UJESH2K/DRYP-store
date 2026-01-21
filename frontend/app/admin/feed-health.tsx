import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FeedHealthScreen() {
  const checks = [
    { label: 'Image URLs valid', status: 'OK' },
    { label: 'Out-of-stock suppression', status: 'OK' },
    { label: 'Broken links', status: '2 issues' },
    { label: 'Category coverage', status: 'Good' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed Health</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {checks.map((c, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.label}>{c.label}</Text>
            <Text style={[styles.status, c.status === 'OK' ? styles.ok : styles.warn]}>{c.status}</Text>
          </View>
        ))}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.blurb}>Add integrations to validate stock updates in real time (ChannelEngine/Shopify). Hook up error reporting for broken images and 404s.</Text>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f8f8f8' },
  label: { fontSize: 14, color: '#333' },
  status: { fontSize: 13 },
  ok: { color: '#2e7d32' },
  warn: { color: '#f57c00' },
  section: { marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  blurb: { fontSize: 13, color: '#666', marginTop: 6 },
});