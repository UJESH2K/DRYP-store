import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import React, { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  JosefinSans_400Regular,
  JosefinSans_600SemiBold,
} from '@expo-google-fonts/josefin-sans';
import { useAuthStore } from '../src/state/auth';
import Toast from '../src/components/Toast';
import ErrorBoundary from '../src/components/common/ErrorBoundary';
import { useCustomRouter } from '../src/hooks/useCustomRouter';
import { initRecommender } from '../src/lib/recommender';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isAuthenticated, user, loadUser } = useAuthStore();
  const [fontsLoaded] = useFonts({
    JosefinSans_400Regular,
    JosefinSans_600SemiBold,
    Zaloga: require('../assets/fonts/Zaloga.ttf'),
  });
  const [authIsReady, setAuthIsReady] = React.useState(false);
  const router = useCustomRouter();

  useEffect(() => {
    async function prepare() {
      try {
        await loadUser();
        await initRecommender();
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

        if (hasCompletedOnboarding) {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/onboarding');
        }
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, user, appIsReady]);

  if (!appIsReady) {
    return null; // Or a loading indicator
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary>
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
      </ErrorBoundary>
      <Toast />
    </SafeAreaProvider>
  );
}
