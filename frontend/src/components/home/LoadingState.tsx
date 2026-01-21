
import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';

export function LoadingState() {
  return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator style={styles.centered} size="large" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
