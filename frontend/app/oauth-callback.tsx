import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../src/state/auth';
import { useCustomRouter } from '../src/hooks/useCustomRouter';

WebBrowser.maybeCompleteAuthSession();

const ERROR_MESSAGES: Record<string, string> = {
  invalid_shop: "That doesn't look like a valid Shopify domain. Use the format your-store.myshopify.com.",
  invalid_platform: "Something went wrong — please try again.",
  account_exists:
    "An account with this Shopify store's email already exists. Please log in first, then connect Shopify from your vendor dashboard.",
  no_vendor_profile: "We couldn't find a studio profile linked to your account.",
  invalid_session: 'Your session expired before authentication could finish. Please try again.',
  oauth_failed: 'Something went wrong completing sign-in. Please try again.',
  google_denied: 'Google login was cancelled.',
  no_code: 'No authorization code was returned. Please try again.',
  invalid_state: 'Your session expired. Please try again.',
  token_exchange_failed: 'Failed to exchange Google credentials. Please try again.',
  no_email: 'Your Google account does not have an email address associated with it.',
};

export default function OAuthCallbackScreen() {
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const { loginWithToken } = useAuthStore();
  const router = useCustomRouter();

  useEffect(() => {
    (async () => {
      if (params.error) {
        Alert.alert('Sign-In Failed', ERROR_MESSAGES[params.error] || 'Sign-in failed.');
        router.replace('/login');
        return;
      }

      if (!params.token) {
        Alert.alert('Sign-In Failed', 'No authentication token was returned.');
        router.replace('/login');
        return;
      }

      const user = await loginWithToken(params.token);
      if (user) {
        router.replace('/');
      } else {
        router.replace('/login');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token, params.error]);

  return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator size="large" color="#1a1a1a" />
      <Text style={styles.text}>Completing sign-in…</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  text: { marginTop: 16, fontSize: 16, color: '#666666', fontFamily: 'Zaloga' },
});
