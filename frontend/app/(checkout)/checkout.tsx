import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView, // Added ScrollView
  FlatList, // Changed FlatList source
} from 'react-native';

import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCartStore } from '../../src/state/cart';
import { useAuthStore } from '../../src/state/auth';
import { useToastStore } from '../../src/state/toast';
import { apiCall } from '../../src/lib/api';
import { SafeAreaView } from 'react-native-safe-area-context';
// @ts-ignore
import CartItem from '../../src/components/checkout/CartItem';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A simple card component for visual grouping
const InfoCard = ({ title, action, children }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>{title}</Text>
      {action}
    </View>
    <View style={styles.cardBody}>
      {children}
    </View>
  </View>
);

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { items, getTotalPrice, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const showToast = useToastStore((state) => state.showToast);
  
  const [shippingAddress, setShippingAddress] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);

  // Fetch initial data (default address and payment)
  useEffect(() => {
    if (params.selectedAddress) {
      setShippingAddress(JSON.parse(params.selectedAddress as string));
    } else {
      const fetchDefaultAddress = async () => {
        try {
          const profile = await apiCall('/api/users/profile');
          if (profile?.addresses?.length > 0) {
            const defaultAddress = profile.addresses.find(a => a.isDefault) || profile.addresses[0];
            setShippingAddress(defaultAddress);
          }
        } catch (error) { console.error('Failed to fetch default address:', error); }
      };
      fetchDefaultAddress();
    }
  }, [params.selectedAddress]);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const payments = await apiCall('/api/payments/methods');
        if (payments?.length > 0) {
          const defaultPayment = payments.find(p => p.isDefault) || payments[0];
          setPaymentMethod(defaultPayment);
        }
      } catch (error) { console.error('Failed to fetch payment methods:', error); }
    };
    fetchPayments();
  }, []);
  
  const subtotal = getTotalPrice();
  const shipping = useMemo(() => subtotal > 75 ? 0 : 9.99, [subtotal]);
  const tax = useMemo(() => subtotal * 0.08, [subtotal]);
  const total = useMemo(() => subtotal + shipping + tax, [subtotal, shipping, tax]);

  const formatPrice = (price: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
  
  const handlePlaceOrder = async () => {
    if (!shippingAddress) {
      showToast('Please select a shipping address.', 'error');
      return;
    }
    if (!paymentMethod) {
      showToast('Please select a payment method.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const orderPayload = {
        items: items.map(item => ({ productId: item.productId, quantity: item.quantity, price: item.price, options: item.options })),
        shippingAddress,
      };

      const result = await apiCall('/api/orders', { method: 'POST', body: JSON.stringify(orderPayload) });

      if (result && result.length > 0) {
        showToast('Order placed successfully!', 'success');
        clearCart();
        router.push({ pathname: '/(checkout)/order-confirmation', params: { orderId: result[0].orderNumber } });
      } else {
        throw new Error('Failed to place order.');
      }
    } catch (error: any) {
      console.error('Order placement error:', error);
      showToast(error?.data?.message || 'An unexpected error occurred.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleItems = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItemsExpanded(!itemsExpanded);
  }

  if (items.length === 0 && !isProcessing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Pressable style={styles.continueShoppingButton} onPress={() => router.push('/(tabs)/home')}>
            <Text style={styles.continueShoppingText}>Continue Shopping</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        
        <Pressable style={styles.itemsHeader} onPress={toggleItems}>
          <Text style={styles.cardTitle}>{items.length} {items.length > 1 ? 'Items' : 'Item'} in Cart</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.detailsActionText}>{itemsExpanded ? 'Hide' : 'View'} Details</Text>
            <Ionicons name={itemsExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6c757d" />
          </View>
        </Pressable>

        {itemsExpanded && (
          <FlatList
            scrollEnabled={false}
            data={items}
            renderItem={({ item }) => <CartItem item={item} />}
            keyExtractor={item => item.id}
            style={styles.itemsList}
          />
        )}

        <InfoCard 
          title="Shipping to"
          action={
            <Pressable onPress={() => router.push('/account/addresses')}>
              <Text style={styles.changeButtonText}>Change</Text>
            </Pressable>
          }>
          {shippingAddress ? (
            <>
              <Text style={styles.cardBodyText}>{shippingAddress.name}</Text>
              <Text style={styles.cardBodyText}>{shippingAddress.line1}</Text>
              <Text style={styles.cardBodyText}>{`${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.pincode}`}</Text>
            </>
          ) : (
            <Text style={styles.cardBodyText}>No address selected.</Text>
          )}
        </InfoCard>

        <InfoCard 
          title="Payment"
          action={
            <Pressable onPress={() => router.push('/account/payment')}>
              <Text style={styles.changeButtonText}>Change</Text>
            </Pressable>
          }>
          {paymentMethod ? (
            <View style={styles.paymentMethodContainer}>
              <Ionicons name="card-outline" size={24} color="#1c1c1e" />
              <Text style={styles.cardBodyText}>{paymentMethod.brand} ending in {paymentMethod.last4}</Text>
            </View>
          ) : (
            <Text style={styles.cardBodyText}>No payment method selected.</Text>
          )}
        </InfoCard>

        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryValue}>{shipping === 0 ? 'FREE' : formatPrice(shipping)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Estimated Tax</Text>
            <Text style={styles.summaryValue}>{formatPrice(tax)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(total)}</Text>
          </View>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.placeOrderButton} onPress={handlePlaceOrder} disabled={isProcessing}>
          {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.placeOrderButtonText}>Place Order</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  scrollView: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  detailsActionText: {
    fontFamily: 'Zaloga',
    fontSize: 16,
    color: '#6c757d',
    marginRight: 4,
  },
  itemsList: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -10, // Overlap with header
    paddingTop: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 12,
  },
  cardTitle: {
    fontFamily: 'Zaloga',
    fontSize: 20,
    color: '#000',
  },
  changeButtonText: {
    fontFamily: 'Zaloga',
    fontSize: 16,
    color: '#007AFF',
  },
  cardBody: {
    paddingTop: 12,
  },
  cardBodyText: {
    fontFamily: 'Zaloga',
    fontSize: 16,
    color: '#1c1c1e',
    lineHeight: 24,
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  summaryTitle: {
    fontFamily: 'Zaloga',
    fontSize: 20,
    color: '#000',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: { fontFamily: 'Zaloga', fontSize: 16, color: '#6c757d' },
  summaryValue: { fontFamily: 'Zaloga', fontSize: 16, color: '#1c1c1e' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#e0e0e0', marginTop: 8, paddingTop: 12 },
  totalLabel: { fontFamily: 'Zaloga', fontSize: 20, color: '#000' },
  totalValue: { fontFamily: 'Zaloga', fontSize: 20, color: '#000' },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  placeOrderButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  placeOrderButtonText: { color: '#fff', fontSize: 18, fontFamily: 'Zaloga' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyTitle: { fontSize: 22, marginBottom: 12, fontFamily: 'Zaloga' },
  continueShoppingButton: { backgroundColor: '#1a1a1a', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  continueShoppingText: { color: '#fff', fontFamily: 'Zaloga' },
});