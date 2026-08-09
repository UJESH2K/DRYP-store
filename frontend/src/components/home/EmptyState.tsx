
import React from 'react';
import { View, Text, Pressable, SafeAreaView, StyleSheet } from 'react-native';

interface EmptyStateProps {
  onClearFilters: () => void;
  error?: string | null;
}

export function EmptyState({ onClearFilters, error }: EmptyStateProps) {
  const isError = !!error;
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.endContainer}>
        <Text style={styles.endTitle}>{isError ? error : 'No products found.'}</Text>
        <Pressable
          style={styles.clearButton}
          onPress={onClearFilters}
          accessibilityRole="button"
          accessibilityLabel={isError ? 'Retry' : 'Clear filters'}
        >
          <Text style={styles.clearButtonText}>{isError ? 'Retry' : 'Clear Filters'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  endContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  endTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  clearButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
