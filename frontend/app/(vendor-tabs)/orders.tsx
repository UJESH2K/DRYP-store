import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { apiCall } from '../../src/lib/api';
import { VendorHeader } from '../../src/components/vendor/Header';
import { useAuthStore } from '../../src/state/auth';

export default function VendorOrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuthStore();

  const fetchOrders = useCallback(async () => {
    if (user?.role !== 'vendor') {
      setError("You are not authorized to view this page.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiCall('/api/orders/vendor');
      if (Array.isArray(data)) {
        const vendorOrders = data.map(order => {
          // Ensure we only process orders that have items for this vendor
          const vendorItems = order.items.filter(item => item.vendor?.toString() === user._id);
          if (vendorItems.length > 0) {
            return { ...order, items: vendorItems };
          }
          return null;
        }).filter(order => order !== null); // Filter out null orders
        setOrders(vendorOrders);
      } else {
        throw new Error(data?.message || 'Failed to fetch orders');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  const renderOrderItem = ({ item }) => (
    <View style={styles.orderCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>Order #{item.orderNumber}</Text>
        <Text style={styles.orderDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>

      {/* This is the fix: check if item.user exists before trying to access its properties */}
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>
          Customer: {item.user ? item.user.name : 'Guest User'}
        </Text>
        {item.user?.email && <Text style={styles.customerEmail}>{item.user.email}</Text>}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.itemsHeader}>Items:</Text>
        {item.items.map(productItem => (
          <View key={productItem.product?._id || Math.random()} style={styles.productItem}>
            <Text style={styles.productName}>{productItem.product?.name || 'Product not found'} (x{productItem.quantity})</Text>
            <Text style={styles.productPrice}>${(productItem.price * productItem.quantity).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.totalAmount}>Total: ${item.totalAmount.toFixed(2)}</Text>
        <Text style={[styles.status, styles[`status_${item.status}`]]}>{item.status}</Text>
      </View>
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text>Error: {error}</Text>
        <Pressable onPress={fetchOrders}><Text style={styles.retryText}>Retry</Text></Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <VendorHeader title="Your Orders" />
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>You have no orders yet.</Text>}
        onRefresh={fetchOrders}
        refreshing={loading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  list: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  retryText: { color: 'blue', marginTop: 10 },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#666' },

  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderNumber: { fontWeight: 'bold', fontSize: 16 },
  orderDate: { color: '#666', fontSize: 14 },
  
  customerInfo: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    paddingVertical: 10,
    marginBottom: 10,
  },
  customerName: {
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 4,
  },
  customerEmail: {
    color: '#3498db',
    fontSize: 14,
  },

  cardBody: { marginBottom: 10 },
  itemsHeader: {
    fontWeight: 'bold',
    marginBottom: 5,
    fontSize: 14,
    color: '#555',
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginLeft: 10,
  },
  productName: {
    color: '#333',
    flexShrink: 1,
  },
  productPrice: {
    fontWeight: '500',
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  totalAmount: { fontWeight: 'bold', fontSize: 16 },
  status: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: 'hidden',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  status_pending: { backgroundColor: '#f0ad4e' },
  status_delivered: { backgroundColor: '#5cb85c' },
  status_cancelled: { backgroundColor: '#d9534f' },
});
