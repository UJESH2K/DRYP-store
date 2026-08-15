import { Stack } from 'expo-router';

export default function AccountLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="addresses"
        options={{
          title: 'My Addresses',
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
        }}
      />
      <Stack.Screen 
        name="edit-address" 
        options={{
          title: 'Edit Address',
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
        }} 
      />
      <Stack.Screen
        name="add-address"
        options={{
          title: 'Add New Address',
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
        }}
      />
      <Stack.Screen name="add-payment-method" options={{ headerShown: false }} />
      <Stack.Screen name="edit-payment-method" options={{ headerShown: false }} />
      <Stack.Screen
        name="settings"
        options={{
          title: 'My Settings',
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
        }}
      />
      {/* Added missing screens to the layout */}
      <Stack.Screen 
        name="about" 
        options={{ 
          title: 'About Us',
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
        }} 
      />
      <Stack.Screen name="change-password" options={{ headerShown: false }} />
      <Stack.Screen 
        name="help" 
        options={{ 
          title: 'Help & Support',
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
        }} 
      />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen
        name="orders"
        options={{
          title: 'My Orders',
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
        }}
      />
      <Stack.Screen
        name="payment"
        options={{
          title: 'Payment Methods',
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
        }}
      />
      <Stack.Screen 
        name="style" 
        options={{ 
          title: 'Style Preferences',
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
        }} 
      />
    </Stack>
  );
}
