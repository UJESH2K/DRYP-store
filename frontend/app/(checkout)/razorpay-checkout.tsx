import React, { useRef, useState, useMemo } from 'react';
import { View, ActivityIndicator, Alert, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams } from 'expo-router';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';
import { API_BASE_URL } from '../../src/lib/config';
import { apiCall } from '../../src/lib/api';

export default function RazorpayCheckoutScreen() {
  const params = useLocalSearchParams();
  const router = useCustomRouter();
  // Checkout passes a JSON queue of per-vendor payments (one Razorpay order
  // per DRYP order). Payments run sequentially: each verified payment
  // confirms that vendor's order before the next checkout WebView opens.
  const queue = useMemo(() => {
    try {
      const parsed = params.queue ? JSON.parse(String(params.queue)) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }, [params.queue]);

  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef(null);
  const busyRef = useRef(false);
  const paidOrderNumbersRef = useRef<string[]>([]);
  const current = queue[index];

  // order_id MUST be the Razorpay order id (intent.id) — the Mongo _id used
  // previously is rejected by Razorpay and can never verify.
  const checkoutUrl = current
    ? `${API_BASE_URL}/api/payments/checkout?order_id=${encodeURIComponent(current.razorpayOrderId)}&key=${process.env.EXPO_PUBLIC_RAZORPAY_KEY || ''}&amount=${encodeURIComponent(String(current.amount))}&currency=${encodeURIComponent(String(current.currency || 'INR'))}`
    : '';

  const finish = () => {
    busyRef.current = false;
    // Confirm the first order that was actually paid. If nothing was paid,
    // fall back to home — the unpaid orders stay visible under My Orders.
    const firstPaid = paidOrderNumbersRef.current[0];
    if (firstPaid) {
      router.replace({
        pathname: '/order-confirmation',
        params: { orderNumber: String(firstPaid) },
      });
    } else {
      router.replace('/(tabs)/home');
    }
  };

  const advance = () => {
    busyRef.current = false;
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      setLoading(true);
    } else {
      finish();
    }
  };

  const handleMessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch (e) {
      return;
    }
    if (data.action === 'cancel') {
      Alert.alert('Payment Cancelled', 'Your payment was cancelled.', [
        { text: 'Skip', onPress: advance },
        { text: 'Stop', onPress: finish, style: 'cancel' },
      ]);
    } else if (data.action === 'failed') {
      const reason = (data.error && (data.error.description || data.error.reason)) || 'Payment failed.';
      Alert.alert('Payment Failed', reason, [{ text: 'OK', onPress: advance }]);
    } else if (data.razorpay_payment_id) {
      if (busyRef.current) return;
      busyRef.current = true;
      verifyPayment(data);
    }
  };

  const verifyPayment = async (paymentData) => {
    const result = await apiCall('/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpayOrderId: paymentData.razorpay_order_id,
        paymentId: paymentData.razorpay_payment_id,
        signature: paymentData.razorpay_signature,
      }),
    });
    if (result && result.verified) {
      if (current && current.orderNumber) paidOrderNumbersRef.current.push(String(current.orderNumber));
      advance();
    } else {
      Alert.alert(
        'Payment Failed',
        (result && result.message) || 'Could not verify payment.',
        [{ text: 'OK', onPress: advance }]
      );
    }
  };

  if (!current) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Payment session not found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {loading && (
        <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center', zIndex: 10 }}>
          <ActivityIndicator size="large" />
          <Text style={{ textAlign: 'center', marginTop: 10 }}>
            {index > 0 ? `Paying order ${index + 1} of ${queue.length}...` : 'Loading payment...'}
          </Text>
        </View>
      )}
      <WebView
        key={String(index)}
        ref={webViewRef}
        source={{ uri: checkoutUrl }}
        onMessage={handleMessage}
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
}
