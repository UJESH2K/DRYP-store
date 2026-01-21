import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore } from '../state/toast';

const Toast: React.FC = () => {
  const { isVisible, message, type, hideToast } = useToastStore();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.spring(translateY, {
        toValue: insets.top,
        useNativeDriver: true,
        bounciness: 5,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, insets.top]);

  if (!message) return null;

  const { backgroundColor, icon, iconColor } = {
    success: {
      backgroundColor: '#28a745',
      icon: 'checkmark-circle-outline' as const,
      iconColor: '#fff',
    },
    error: {
      backgroundColor: '#dc3545',
      icon: 'alert-circle-outline' as const,
      iconColor: '#fff',
    },
    info: {
      backgroundColor: '#007bff',
      icon: 'information-circle-outline' as const,
      iconColor: '#fff',
    },
  }[type];

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, transform: [{ translateY }] },
      ]}
    >
      <Ionicons name={icon} size={24} color={iconColor} style={styles.icon} />
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Zaloga',
    flex: 1,
  },
});

export default Toast;
