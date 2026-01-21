import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  const getIconName = () => {
    switch (name) {
      case 'analytics':
        return focused ? 'analytics' : 'analytics-outline';
      case 'orders':
        return focused ? 'receipt' : 'receipt-outline';
      case 'products':
        return focused ? 'list-circle' : 'list-circle-outline';
      case 'store':
        return focused ? 'storefront' : 'storefront-outline';
      default:
        return 'ellipse-outline';
    }
  };

  return <Ionicons name={getIconName()} size={26} color={focused ? '#1a1a1a' : '#888'} />;
}

export default function VendorTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1a1a1a',
        tabBarStyle: {
          height: 60,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontFamily: 'Zaloga',
        },
      }}
    >
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ focused }) => <TabBarIcon name="analytics" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => <TabBarIcon name="orders" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ focused }) => <TabBarIcon name="products" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: 'Store',
          tabBarIcon: ({ focused }) => <TabBarIcon name="store" focused={focused} />,
        }}
      />
    </Tabs>
  );
}