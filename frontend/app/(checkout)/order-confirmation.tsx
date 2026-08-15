import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, Image, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../../src/lib/api';
import { API_BASE_URL } from '../../src/lib/config';
import { resolveImageUri } from '../../src/utils/imageUri';
import { formatPrice } from '../../src/utils/formatting';

export default function OrderConfirmationScreen() {
  const router = useCustomRouter();
  const { orderId, orderNumber } = useLocalSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      // Payments navigate with the human order number (DRYP-XXXX-YYYY);
      // orderId is a legacy fallback that may hold a Mongo _id.
      const numberParam = orderNumber ? String(orderNumber) : '';
      const idParam = orderId ? String(orderId) : '';
      const byNumber = numberParam || (idParam.startsWith('DRYP-') ? idParam : '');
      if (!byNumber && !idParam) {
        setLoading(false);
        return;
      }
      try {
        if (byNumber) {
          const result = await apiCall(`/api/orders/by-number/${encodeURIComponent(String(byNumber))}`);
          // apiCall never throws: failures come back as { message }. Only a
          // real order carries orderNumber — anything else is "not found".
          setOrder(result && result.orderNumber ? result : null);
        } else {
          const result = await apiCall(`/api/orders/${encodeURIComponent(idParam)}`);
          setOrder(result && result.orderNumber ? result : null);
        }
      } catch (error) {
        console.error('Failed to fetch order:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, orderNumber]);

  const renderOrderItem = ({ item }: { item: any }) => (
    <View style={styles.itemContainer}>
      <Image
        source={{ uri: item.product?.images?.[0] ? resolveImageUri(item.product.images[0]) : undefined }}
        style={styles.itemImage}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.product?.name || 'Unavailable item'}</Text>
        <Text style={styles.itemDetailsText}>Brand: {item.product?.brand || ''}</Text>
        <Text style={styles.itemDetailsText}>Qty: {item.quantity}</Text>
      </View>
      <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Loading Order Details...</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <Ionicons name="alert-circle-outline" size={80} color="#d9534f" />
        <Text style={styles.title}>Order Not Found</Text>
        <Text style={styles.subtitle}>We couldn't find the order details. Please check the order number or contact support.</Text>
        <Pressable style={styles.button} onPress={() => router.replace('/(tabs)/home')}>
          <Text style={styles.buttonText}>Go to Homepage</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={90} color="#28a745" />
          <Text style={styles.title}>Thank You For Your Order!</Text>
          <Text style={styles.subtitle}>
            Your order <Text style={styles.orderNumber}>#{order.orderNumber}</Text> has been placed successfully.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Summary</Text>
          <FlatList
            data={order.items}
            renderItem={renderOrderItem}
            keyExtractor={(item) => item.product?._id || item._id || String(Math.random())}
            scrollEnabled={false}
          />
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatPrice(order.subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Shipping</Text>
              <Text style={styles.summaryValue}>{formatPrice(order.shippingCost)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>{formatPrice(order.tax)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(order.totalAmount)}</Text>
            </View>
          </View>
        </View>

        <Pressable style={styles.button} onPress={() => router.replace('/(tabs)/home')}>
          <Text style={styles.buttonText}>Continue Shopping</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    alignItems: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    marginTop: 20,
    fontFamily: 'Zaloga',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Zaloga',
    lineHeight: 24,
  },
  orderNumber: {
    fontFamily: 'Zaloga',
    color: '#000',
  },
  button: {
    backgroundColor: '#000',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Zaloga',
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    marginBottom: 15,
    fontFamily: 'Zaloga',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
    backgroundColor: '#eee',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    marginBottom: 4,
  },
  itemDetailsText: {
    fontSize: 14,
    fontFamily: 'Zaloga',
    color: '#6c757d',
  },
  itemPrice: {
    fontSize: 16,
    fontFamily: 'Zaloga',
  },
  summaryContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    color: '#6c757d',
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: 'Zaloga',
  },
  totalRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#ddd',
  },
  totalLabel: {
    fontSize: 18,
    fontFamily: 'Zaloga',
  },
  totalValue: {
    fontSize: 18,
    fontFamily: 'Zaloga',
  },
  loadingText: {
    marginTop: 10,
    fontFamily: 'Zaloga',
    fontSize: 16,
  }
});
