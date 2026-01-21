
import React from 'react';
import { View, Text, Pressable, SafeAreaView, StyleSheet } from 'react-native';

interface EmptyStateProps {
  onClearFilters: () => void;
}

export function EmptyState({ onClearFilters }: EmptyStateProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.endContainer}>
        <Text style={styles.endTitle}>No products found.</Text>
        <Pressable style={styles.clearButton} onPress={onClearFilters}>
          <Text style={styles.clearButtonText}>Clear Filters</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  endContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  endTitle: { fontSize: 20, fontWeight: '700' },
  clearButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#2196F3',
    borderRadius: 5,
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
  },
});
