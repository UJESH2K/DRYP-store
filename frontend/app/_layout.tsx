import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import {
  useFonts,
  JosefinSans_400Regular,
  JosefinSans_500Medium,
  JosefinSans_600SemiBold,
} from '@expo-google-fonts/josefin-sans';
import { CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond';
import { useAuthStore } from '../src/state/auth';
import { useInteractionStore } from '../src/state/interactions';
import Toast from '../src/components/Toast';
import { useCustomRouter } from '../src/hooks/useCustomRouter';
import { ErrorBoundary } from '../src/components/common/ErrorBoundary';

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
        await Promise.all([loadUser(), useInteractionStore.getState().hydrate()]);
      } catch (e) {
        console.warn(e);
      } finally {
        setAuthIsReady(true);
      }
    }

    prepare();
  }, []);

  // Deep link handler. Tapping a `dryp://reset-password/<token>` link in the
  // password-reset email opens the app at this URL; we extract the token and
  // route to the in-app reset screen. Without this, the email would either
  // open Safari (cold launch) or hit a 404 inside the app (warm launch).
  useEffect(() => {
    function handleUrl(event: { url: string }) {
      const { path, queryParams } = Linking.parse(event.url);
      // `dryp://reset-password/<token>` parses to path === 'reset-password'
      // with the token as a path segment, or sometimes as a query param
      // depending on the URL form. Handle both.
      const pathSegments = (path || '').split('/').filter(Boolean);
      if (pathSegments[0] === 'reset-password' && pathSegments[1]) {
        router.push(`/reset-password/${encodeURIComponent(pathSegments[1])}`);
        return;
      }
      if (queryParams?.token) {
        router.push(
          `/reset-password/${encodeURIComponent(String(queryParams.token))}`,
        );
        return;
      }
      // Vendor-approval link may also come through as a deep link once
      // vendor signup → email → tap-on-phone is wired up. Forward to
      // /vendor-register with the token so the screen can validate it.
      if (pathSegments[0] === 'vendor-register' && pathSegments[1]) {
        router.push(
          `/vendor-register?token=${encodeURIComponent(pathSegments[1])}`,
        );
        return;
      }
    }
    // Cold start: app was launched by the URL. Linking.getInitialURL
    // returns the URL the app was started with, if any.
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });
    // Warm: app was already running and we got a new URL.
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
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
            <Stack.Screen
              name="product/[id]"
              options={{
                title: '',
                headerShown: true,
                headerTransparent: true,
                headerStyle: {
                  backgroundColor: 'transparent',
                },
                headerTintColor: '#1a1a1a',
                headerTitleStyle: {
                  fontFamily: 'Zaloga',
                  fontSize: 18,
                },
                headerShadowVisible: false,
              }}
            />
          </Stack>
        </ErrorBoundary>
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
