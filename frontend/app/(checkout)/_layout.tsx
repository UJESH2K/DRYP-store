import { Stack } from 'expo-router';

export default function CheckoutLayout() {
  const screenOptions = {
    headerShown: true,
    headerStyle: {
      backgroundColor: '#ffffff',
    },
    headerTintColor: '#1a1a1a',
    headerTitleStyle: {
      fontFamily: 'Zaloga',
      fontSize: 28,
    },
    headerShadowVisible: false,
  };

  return (
    <Stack>
      <Stack.Screen name="checkout" options={{ ...screenOptions, title: 'Checkout' }} />
      <Stack.Screen name="order-confirmation" options={{ ...screenOptions, title: 'Order Confirmed' }} />
      <Stack.Screen name="select-address" options={{ ...screenOptions, title: 'Select Address' }} />
      <Stack.Screen name="add-address" options={{ ...screenOptions, title: 'Add New Address' }} />
    </Stack>
  );
}
