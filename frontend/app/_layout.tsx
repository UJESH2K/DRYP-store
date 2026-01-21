import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  JosefinSans_400Regular,
  JosefinSans_500Medium,
  JosefinSans_600SemiBold,
} from '@expo-google-fonts/josefin-sans';
import { CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond';
import { useAuthStore } from '../src/state/auth';
import Toast from '../src/components/Toast';
import { useCustomRouter } from '../src/hooks/useCustomRouter';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isAuthenticated, isGuest, user, loadUser } = useAuthStore();
  const [fontsLoaded] = useFonts({
    JosefinSans_400Regular,
    JosefinSans_500Medium,
    JosefinSans_600SemiBold,
    CormorantGaramond_700Bold,
    Zaloga: require('../assets/fonts/Zaloga.ttf'),
  });
  const [authIsReady, setAuthIsReady] = React.useState(false);
  const router = useCustomRouter();

  useEffect(() => {
    async function prepare() {
      try {
        await loadUser();
      } catch (e) {
        console.warn(e);
      } finally {
        setAuthIsReady(true);
      }
    }

    prepare();
  }, []);

  const appIsReady = fontsLoaded && authIsReady;

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  useEffect(() => {
    if (appIsReady) {
      if (isAuthenticated) {
        const hasCompletedOnboarding =
          user?.preferences &&
          (user.preferences.categories.length > 0 ||
            user.preferences.colors.length > 0 ||
            user.preferences.brands.length > 0);

        if (user?.role === 'vendor') {
          router.replace('/(vendor-tabs)/products');
        } else if (hasCompletedOnboarding) {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/onboarding');
        }
      } else if (isGuest) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isGuest, user, appIsReady]);

  if (!appIsReady) {
    return null; // Or a loading indicator
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen 
            name="liked-items" 
            options={{ 
              title: 'Liked Items',
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
            name="notifications" 
            options={{ 
              title: 'Notifications',
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
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
