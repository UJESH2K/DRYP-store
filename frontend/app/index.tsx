import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

// Splash placeholder. Auth/onboarding routing is owned by
// `app/_layout.tsx` so this file must NOT issue its own <Redirect/> —
// doing so races with the layout and can send the user to the wrong
// place (e.g. /(tabs)/home when they should be on /login).
//
// We render a brief spinner so the splash screen transition is smooth,
// then render null to defer to whatever route the layout has selected.
export default function Index() {
  const [minDelayElapsed, setMinDelayElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinDelayElapsed(true), 300);
    return () => clearTimeout(t);
  }, []);

  if (!minDelayElapsed) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Loading DRYP...</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 20,
  },
});
