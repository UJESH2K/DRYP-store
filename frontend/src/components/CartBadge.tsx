import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCartStore } from '../state/cart';

export default function CartBadge({ children }) {
  const count = useCartStore((s) => s.getTotalItems());

  return (
    <View>
      {children}
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.text}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: 'red',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
