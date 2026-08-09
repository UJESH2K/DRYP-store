import React, { useRef, useState } from 'react';
import { View, ActivityIndicator, Alert, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams } from 'expo-router';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';
import { API_BASE_URL } from '../../src/lib/config';
import { apiCall } from '../../src/lib/api';

export default function RazorpayCheckoutScreen() {
  const params = useLocalSearchParams();
  const router = useCustomRouter();
  const orderId = String(params.orderId || '');
  const amount = String(params.amount || '0');
  const currency = String(params.currency || 'INR');
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef(null);

  const checkoutUrl = `${API_BASE_URL}/api/payments/checkout?order_id=${orderId}&key=${process.env.EXPO_PUBLIC_RAZORPAY_KEY || ''}&amount=${amount}&currency=${currency}`;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'cancel') {
        Alert.alert('Payment Cancelled', 'Your payment was cancelled.', [
          { text: 'Try Again', onPress: () => router.replace('/(tabs)/home') },
        ]);
      } else if (data.razorpay_payment_id) {
        verifyPayment(data);
      }
    } catch (e) {}
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
      router.replace({ pathname: '/order-confirmation', params: { orderId: orderId } });
    } else {
      Alert.alert('Payment Failed', (result && result.message) || 'Could not verify payment.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {loading && (
        <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center', zIndex: 10 }}>
          <ActivityIndicator size="large" />
          <Text style={{ textAlign: 'center', marginTop: 10 }}>Loading payment...</Text>
        </View>
      )}
      <WebView ref={webViewRef} source={{ uri: checkoutUrl }} onMessage={handleMessage} onLoadEnd={() => setLoading(false)} javaScriptEnabled={true} domStorageEnabled={true} />
    </View>
  );
}
