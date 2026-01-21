import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface AnimatedLoadingScreenProps {
  text?: string;
}

export default function AnimatedLoadingScreen({ text = 'Loading...' }: AnimatedLoadingScreenProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // Pulsing animation for the logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Fading animation for the text
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scaleAnim, opacityAnim]);

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.logo, { transform: [{ scale: scaleAnim }] }]}>
        DRYP
      </Animated.Text>
      <Animated.Text style={[styles.loadingText, { opacity: opacityAnim }]}>
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  logo: {
    fontSize: 48,
    color: '#000',
    marginBottom: 20,
    fontFamily: 'Zaloga',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontFamily: 'Zaloga',
  },
});
