/**
 * GoogleSignInButton.tsx — Phase 4B. Reusable "Continue with Google" button.
 *
 * Uses `expo-auth-session` with the `id_token` flow (the recommended
 * Expo approach for both iOS and Android). The user taps the button,
 * sees the system Google sheet, picks an account, and we POST the
 * resulting `id_token` to `/api/auth/google`. The backend verifies
 * with Google and returns `{ token, user }`.
 *
 * Setup (one-time):
 *   1. `cd frontend && npm install expo-auth-session expo-crypto`
 *      (also install `@react-native-google-signin/google-signin` if
 *      you want native iOS/Android buttons — this component works
 *      without it).
 *   2. Create OAuth client ids:
 *      - Web: https://console.cloud.google.com → Credentials → Create
 *        OAuth client ID → Web application.
 *      - iOS: same → iOS application, bundle id `com.dryp.app`.
 *      - Android: same → Android application, package `com.dryp.app`.
 *   3. Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (and optionally iOS
 *      and Android client ids) in your .env / EAS secrets.
 *   4. Backend: set `GOOGLE_CLIENT_ID` to the same web client id
 *      (the backend only verifies aud against the web id).
 *
 * Once those are in place, drop <GoogleSignInButton /> into your
 * login screen.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

// Lazy-require so the app still runs without expo-auth-session
// installed (we don't want to break the dev build before the
// package is added).
let useIdTokenAuthRequest: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  useIdTokenAuthRequest = require('expo-auth-session').useIdTokenAuthRequest;
} catch (_) {
  useIdTokenAuthRequest = null;
}

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

interface Props {
  onSuccess?: (user: any) => void;
  onError?: (err: string) => void;
  label?: string;
}

export default function GoogleSignInButton({ onSuccess, onError, label = 'Continue with Google' }: Props) {
  const [busy, setBusy] = useState(false);

  // Hook must be called unconditionally — but if the package is
  // missing, fall back to a no-op button that shows an install hint.
  let request: any = null;
  let response: any = null;
  let promptAsync: any = () => {};
  if (useIdTokenAuthRequest) {
    // useIdTokenAuthRequest returns a 3-tuple; we destructure into
    // let-binding variables above so the missing-package branch
    // gets safe defaults.
    const r = useIdTokenAuthRequest({
      clientId: WEB_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
    });
    request = r[0];
    response = r[1];
    promptAsync = r[2];
  }

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.id_token || response.params?.access_token;
      if (!idToken) {
        onError?.('No id_token returned');
        return;
      }
      setBusy(true);
      import('../state/auth').then(({ useAuthStore }) => {
        useAuthStore.getState().signInWithGoogle(idToken).then((user) => {
          setBusy(false);
          if (user) onSuccess?.(user);
          else onError?.('Sign-in failed');
        });
      });
    } else if (response.type === 'error') {
      onError?.(response.error?.message || 'Google auth error');
    } else if (response.type === 'cancel' || response.type === 'dismiss') {
      // User closed the sheet; nothing to do.
    }
  }, [response]);

  const onPress = async () => {
    if (!useIdTokenAuthRequest) {
      onError?.('Google sign-in requires `npm install expo-auth-session`.');
      return;
    }
    if (!WEB_CLIENT_ID) {
      onError?.('Google sign-in is not configured (missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).');
      return;
    }
    try {
      await promptAsync();
    } catch (e: any) {
      onError?.(e?.message || 'Failed to open Google sign-in');
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, busy && styles.btnBusy]}
    >
      {busy ? (
        <ActivityIndicator color="#1a1a1a" />
      ) : (
        <View style={styles.row}>
          <Text style={styles.g}>G</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: { opacity: 0.85 },
  btnBusy: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center' },
  g: {
    fontFamily: 'serif',
    fontWeight: '700',
    fontSize: 18,
    color: '#4285F4',
    marginRight: 8,
  },
  label: { color: '#1a1a1a', fontWeight: '500', fontSize: 15 },
});