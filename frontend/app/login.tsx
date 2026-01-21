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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TextTicker from 'react-native-text-ticker';
import { FontAwesome } from '@expo/vector-icons';
import { useAuthStore } from '../src/state/auth';
import { useCustomRouter } from '../src/hooks/useCustomRouter';

export default function LoginScreen() {
  const router = useCustomRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const { login, register, isLoading } = useAuthStore();

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

  const handleSocialLogin = (provider: string) => {
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
            <Pressable style={styles.socialButton} onPress={() => handleSocialLogin('Apple')}>
              <FontAwesome name="apple" size={24} color="black" />
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable onPress={toggleMode} style={styles.toggleButton}>
            <Text style={styles.toggleButtonText}>
              {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.push('/vendor-register')} style={styles.toggleButton}>
            <Text style={styles.toggleButtonText}>
              Become a Vendor
            </Text>
          </Pressable>
          
          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>Continue as Guest</Text>
          </Pressable>
          
          <Text style={styles.terms}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
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

});