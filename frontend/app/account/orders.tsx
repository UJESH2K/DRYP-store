import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';
import { useFocusEffect } from 'expo-router';
import { apiCall } from '../../src/lib/api';
import { useAuthStore } from '../../src/state/auth';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.9:5000';

export default function OrdersScreen() {
  const router = useCustomRouter();
  const { user, isGuest, guestId } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async () => {
    if (!user && (!isGuest || !guestId)) {
      setError("Please log in to see your orders.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('/api/orders/mine');
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch user orders:", e);
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [user, isGuest, guestId]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return { color: '#28a745', text: 'Delivered' };
      case 'shipped': return { color: '#007bff', text: 'Shipped' };
      case 'processing': return { color: '#fd7e14', text: 'Processing' };
      case 'pending': return { color: '#ffc107', text: 'Pending' };
      case 'cancelled': return { color: '#dc3545', text: 'Cancelled' };
      default: return { color: '#6c757d', text: 'Unknown' };
    }
  };

  const formatPrice = (price: number = 0) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);

  const renderOrderItem = ({ item }: { item: any }) => {
    const statusStyle = getStatusStyle(item.status);
    return (
      <Pressable style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>Order #{item.orderNumber}</Text>
          <Text style={[styles.orderDate, { flex: 1, textAlign: 'right' }]}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, { backgroundColor: statusStyle.color }]} />
          <Text style={[styles.orderStatus, { color: statusStyle.color }]}>
            {statusStyle.text}
          </Text>
        </View>
        
        <View style={styles.itemsList}>
          {item.items.map((productItem: any, index: number) => {
            const product = productItem.product;
            if (!product) {
              return (
                <View key={`deleted-${index}`} style={styles.productItem}>
                  <View style={[styles.productImage, styles.imagePlaceholder]} />
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>Product no longer available</Text>
                  </View>
                </View>
              );
            }
            return (
              <View key={product._id} style={styles.productItem}>
                <Image 
                  source={{ uri: `${API_BASE_URL}${product.images[0]}` }} 
                  style={styles.productImage} 
                />
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productDetails}>Qty: {productItem.quantity}</Text>
                </View>
                <Text style={styles.productPrice}>{formatPrice(productItem.price)}</Text>
              </View>
            );
          })}
        </View>
        
        <View style={styles.orderFooter}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatPrice(item.totalAmount)}</Text>
        </View>
      </Pressable>
    );
  };

  const ListHeader = () => null; // Empty component as the title will be moved

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {/* The navigation bar should provide the title */}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      {/* The navigation bar should provide the title */}
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>{error || "You have no orders yet."}</Text>
            {error && <Pressable onPress={fetchOrders}><Text style={styles.retryText}>Try Again</Text></Pressable>}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  headerContainer: {
    paddingVertical: 16,
  },
  headerTitle: {
    fontFamily: 'Zaloga',
    fontSize: 28,
    color: '#000',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontFamily: 'Zaloga',
    fontSize: 18,
    color: '#000',
  },
  orderDate: {
    fontFamily: 'Zaloga',
    fontSize: 14,
    color: '#6c757d',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  orderStatus: {
    fontFamily: 'Zaloga',
    fontSize: 16,
    textTransform: 'capitalize',
  },
  itemsList: {
    marginBottom: 12,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  productImage: {
    width: 50,
    height: 65,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  imagePlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontFamily: 'Zaloga',
    fontSize: 16,
    color: '#343a40',
    marginBottom: 2,
  },
  productDetails: {
    fontFamily: 'Zaloga',
    fontSize: 14,
    color: '#6c757d',
  },
  productPrice: {
    fontFamily: 'Zaloga',
    fontSize: 16,
    color: '#000',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  totalLabel: {
    fontFamily: 'Zaloga',
    fontSize: 18,
    color: '#343a40',
  },
  totalAmount: {
    fontFamily: 'Zaloga',
    fontSize: 18,
    color: '#000',
  },
  emptyText: {
    fontFamily: 'Zaloga',
    textAlign: 'center',
    fontSize: 16,
    color: '#6c757d',
  },
  retryText: {
    fontFamily: 'Zaloga',
    fontSize: 16,
    color: '#007AFF',
    marginTop: 10,
  },
});