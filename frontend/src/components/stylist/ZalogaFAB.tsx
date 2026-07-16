import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Zaloga } from '../../constants/theme';

interface ZalogaFABProps {
  visible: boolean;
  onPress: () => void;
}

export default function ZalogaFAB({ visible, onPress }: ZalogaFABProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts();

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.18,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  if (!visible || !fontsLoaded) return null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Ask Zaloga, the AI Stylist"
      style={({ pressed }) => [
        styles.container,
        { bottom: 80 + insets.bottom },
        pressed && styles.pressed,
      ]}
    >
      <Animated.View style={[styles.orb, { transform: [{ scale: pulse }] }]}>
        <Text style={styles.label}>Z</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    zIndex: 50,
    elevation: 6,
  },
  orb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  label: {
    fontFamily: 'Zaloga',
    fontSize: 26,
    color: '#FFF',
    includeFontPadding: false,
  },
  pressed: {
    opacity: 0.85,
  },
});
