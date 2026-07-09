import React, { ReactNode, useRef } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Text,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SWIPE_THRESHOLD = -80;

interface SwipeableRowProps {
  children: ReactNode;
  onDelete: () => void;
}

export default function SwipeableRow({ children, onDelete }: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetX = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 8,
      onPanResponderGrant: () => {
        translateX.stopAnimation((value) => {
          offsetX.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const next = offsetX.current + gestureState.dx;
        translateX.setValue(Math.min(0, Math.max(next, SWIPE_THRESHOLD)));
      },
      onPanResponderRelease: (_, gestureState) => {
        const current = offsetX.current + gestureState.dx;
        const toValue = current < SWIPE_THRESHOLD / 2 ? SWIPE_THRESHOLD : 0;
        Animated.spring(translateX, {
          toValue,
          useNativeDriver: true,
          bounciness: 0,
        }).start(() => {
          offsetX.current = toValue;
        });
      },
    })
  ).current;

  const handleDelete = () => {
    onDelete();
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start(() => {
      offsetX.current = 0;
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.deleteAction}>
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={24} color="#fff" />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View
        style={[styles.content, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: Math.abs(SWIPE_THRESHOLD),
  },
  deleteButton: {
    backgroundColor: '#ff4d4f',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 4,
  },
  content: {
    backgroundColor: '#fff',
  },
});