import { Tabs, useFocusEffect, usePathname } from 'expo-router';
import React from 'react';
import { BackHandler } from 'react-native';
import { useNavigationStore } from '../../src/state/navigation';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';
import { Ionicons } from '@expo/vector-icons';
import CartBadge from '../../src/components/CartBadge';

export default function TabLayout() {
  const { push, goBack } = useNavigationStore();
  const router = useCustomRouter();
  const pathname = usePathname();

  useFocusEffect(
    React.useCallback(() => {
      push(pathname);
    }, [pathname, push])
  );

  React.useEffect(() => {
    const backAction = () => {
      const backPath = goBack();
      if (backPath) {
        router.replace(backPath);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [goBack, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: 'black',
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
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ color }) => <Ionicons name="bookmark-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color }) => (
            <CartBadge>
              <Ionicons name="cart-outline" size={24} color={color} />
            </CartBadge>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
