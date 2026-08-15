import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TextTicker from 'react-native-text-ticker';
import { FontAwesome } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
// Required for expo-web-browser to complete auth sessions on iOS
WebBrowser.maybeCompleteAuthSession();
import { useAuthStore } from '../src/state/auth';
import { useCustomRouter } from '../src/hooks/useCustomRouter';
import { apiCall, API_BASE_URL } from '../src/lib/api';

const appleAuthAvailable = Platform.OS === 'ios';

export default function LoginScreen() {
  const router = useCustomRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const { login, register, loginWithToken, isLoading, guestId } = useAuthStore();

  const handleAuthAction = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email and password are required.');
      return;
    }
    if (mode === 'register' && !name) {
      Alert.alert('Error', 'Name is required for registration.');
      return;
    }

    let user = null;
    if (mode === 'login') {
      user = await login(email, password);
    } else {
      user = await register(name, email, password);
    }

    if (user) {
      // The redirection is now handled in the root layout
    } else {
      // The auth store will show a more specific error
    }
  };

  const handleGoogleLogin = async () => {
    const redirectUri = makeRedirectUri({
      scheme: 'dryp',
      path: 'oauth-callback',
    });

    const guestQuery = guestId ? `&guestId=${encodeURIComponent(guestId)}` : '';
    const authUrl = `${API_BASE_URL}/api/auth/google?platform=mobile&redirect_uri=${encodeURIComponent(redirectUri)}${guestQuery}`;

    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success') {
        const queryString = result.url.split('?')[1] || '';
        const params = new URLSearchParams(queryString);
        const error = params.get('error');

        if (error) {
          const messages: Record<string, string> = {
            google_denied: 'Google sign-in was cancelled.',
            no_code: 'No authorization code received from Google.',
            invalid_state: 'Session expired. Please try again.',
            token_exchange_failed: 'Could not complete sign-in. Please try again.',
            oauth_failed: 'Google authentication failed. Please try again.',
            no_email: 'Could not retrieve email from Google.',
          };
          Alert.alert('Sign-In Failed', messages[error] || 'An unknown error occurred during sign-in.');
          return;
        }

        const token = params.get('token');
        if (token) {
          const user = await loginWithToken(token);
          if (user) {
            router.replace('/(tabs)/home');
          } else {
            Alert.alert('Sign-In Failed', 'Could not authenticate with the returned token.');
          }
        } else {
          Alert.alert('Sign-In Failed', 'No token received from server.');
        }
      } else if (result.type === 'dismiss') {
        // User closed the browser manually — do nothing
      }
    } catch (err) {
      console.error('Google login error:', err);
      Alert.alert('Google Sign-In', 'Something went wrong. Please try again.');
    }
  };

  const handleAppleLogin = async () => {
    // Native Sign in with Apple only exists on iOS (Apple guideline 4.8 +
    // platform sanity); the button is not rendered on Android at all.
    if (Platform.OS !== 'ios') return;

    try {
      if (!(await AppleAuthentication.isAvailableAsync())) return;
    } catch (err) {
      console.error('Apple auth availability check failed:', err);
      return;
    }

    setIsAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        Alert.alert('Sign-In Failed', 'No identity token was returned by Apple.');
        return;
      }

      const fullName = credential.fullName
        ? {
            givenName: credential.fullName.givenName || undefined,
            familyName: credential.fullName.familyName || undefined,
          }
        : undefined;

      const response = await apiCall('/api/auth/apple', {
        method: 'POST',
        body: JSON.stringify({
          identityToken: credential.identityToken,
          fullName,
          guestId: guestId || undefined,
        }),
      });

      if (response && response.token) {
        const user = await loginWithToken(response.token);
        if (user) {
          router.replace('/(tabs)/home');
        } else {
          Alert.alert('Sign-In Failed', 'Could not authenticate with the returned token.');
        }
      } else {
        Alert.alert('Sign-In Failed', (response && response.message) || 'Apple sign-in failed. Please try again.');
      }
    } catch (err) {
      if (err && typeof err.code === 'string' && err.code === 'ERR_REQUEST_CANCELED') {
        // User tapped Cancel in the native sheet — not an error.
        return;
      }
      console.error('Apple login error:', err);
      Alert.alert('Apple Sign-In', 'Something went wrong. Please try again.');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    if (provider === 'Google') {
      handleGoogleLogin();
      return;
    }
    if (provider === 'Apple') {
      handleAppleLogin();
      return;
    }
    Alert.alert('Coming Soon', `Login with ${provider} is not available yet.`);
  };

  const handleSkip = () => {
    router.replace('/(tabs)/home');
  };

  const toggleMode = () => {
    setMode(currentMode => currentMode === 'login' ? 'register' : 'login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
        <Text style={styles.logo}>DRYP</Text>
        <TextTicker
          style={styles.marqueeText}
          duration={15000}
          loop
          repeatSpacer={50}
          marqueeDelay={1000}
        >
          STREETWEAR • MODERN ESSENTIALS • HANDCRAFT • PREMIUM
        </TextTicker>
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Sign in to your account' : 'Get started with a new account'}
          </Text>
        </View>

        <View style={styles.form}>
          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Your Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleAuthAction}
          />

          <Pressable 
            style={styles.primaryButton} 
            onPress={handleAuthAction}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.socialLoginContainer}>
          <View style={styles.separator}>
            <Text style={styles.separatorText}>OR</Text>
          </View>
          <View style={styles.socialIconsContainer}>
            <Pressable style={styles.socialButton} onPress={() => handleSocialLogin('Google')}>
              <FontAwesome name="google" size={24} color="black" />
            </Pressable>
            {appleAuthAvailable && (
              <Pressable
                style={styles.socialButton}
                onPress={() => handleSocialLogin('Apple')}
                disabled={isAppleLoading}
              >
                {isAppleLoading ? (
                  <ActivityIndicator size="small" color="black" />
                ) : (
                  <FontAwesome name="apple" size={24} color="black" />
                )}
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable onPress={toggleMode} style={styles.toggleButton}>
            <Text style={styles.toggleButtonText}>
              {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </Text>
          </Pressable>

          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>Continue as Guest</Text>
          </Pressable>
          
          <View style={styles.termsContainer}>
            <Text style={styles.terms}>By continuing, you agree to our </Text>
            <Pressable onPress={() => Linking.openURL('https://www.dryp.store/legal/terms')}>
              <Text style={styles.termsLink}>Terms of Service</Text>
            </Pressable>
            <Text style={styles.terms}> and </Text>
            <Pressable onPress={() => Linking.openURL('https://www.dryp.store/legal/privacy')}>
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-around',
  },
  header: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  logo: {
    fontSize: 60,
    fontFamily: 'Zaloga',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  marqueeText: {
    fontSize: 14,
    fontFamily: 'Zaloga',
    color: '#666666',
    textAlign: 'center',
    marginVertical: 5,
  },
  title: {
    fontSize: 28,
    color: '#1a1a1a',
    marginBottom: 8,
    fontFamily: 'Zaloga',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    fontFamily: 'Zaloga',
  },
  form: {
    marginVertical: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    marginBottom: 12,
    fontFamily: 'Zaloga',
  },
  primaryButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Zaloga',
  },
  socialLoginContainer: {
    marginVertical: 10,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  separatorText: {
    fontFamily: 'Zaloga',
    color: '#666666',
    paddingHorizontal: 10,
  },
  socialIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialButton: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  footer: {
    paddingBottom: 20,
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  toggleButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontFamily: 'Zaloga',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 15,
  },
  skipButtonText: {
    color: '#666666',
    fontSize: 16,
    fontFamily: 'Zaloga',
  },
  terms: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Zaloga',
  },
  termsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsLink: {
    fontSize: 12,
    color: '#FF6B6B',
    textDecorationLine: 'underline',
    fontFamily: 'Zaloga',
  },

});