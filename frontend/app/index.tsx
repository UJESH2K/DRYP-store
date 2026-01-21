import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        console.log('Checking onboarding status...');
        
        // Add timeout for Android
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AsyncStorage timeout')), 3000)
        );
        
        const storagePromise = AsyncStorage.getItem('categories:selected');
        const result = await Promise.race([storagePromise, timeoutPromise]) as string | null;
        
        console.log('AsyncStorage result:', result);
        
        if (result) {
          const categories = JSON.parse(result);
          if (categories && categories.length > 0) {
            setHasOnboarded(true);
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        // Continue to onboarding on error
      } finally {
        setIsLoading(false);
      }
    };

    // Add a minimum loading time to prevent flash
    setTimeout(checkOnboardingStatus, Platform.OS === 'android' ? 1000 : 100);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Loading DRYP...</Text>
        {Platform.OS === 'android' && (
          <Text style={styles.platformText}>Initializing Android app</Text>
        )}
        {error && (
          <Text style={styles.errorText}>Error: {error}</Text>
        )}
      </View>
    );
  }

  // Navigate based on onboarding status
  if (hasOnboarded) {
    console.log('User has onboarded, going to home');
    return <Redirect href="/(tabs)/home" />;
  } else {
    console.log('User needs onboarding, going to onboarding');
    return <Redirect href="/onboarding" />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 20,
    textAlign: 'center',
  },
  platformText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#ff0000',
    marginTop: 8,
    textAlign: 'center',
  },
});