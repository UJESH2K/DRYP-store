import React, { ReactNode } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const SWIPE_THRESHOLD = -80;

interface SwipeableRowProps {
  children: ReactNode;
  onDelete: () => void;
}

export default function SwipeableRow({ children, onDelete }: SwipeableRowProps) {
  const translateX = useSharedValue(0);

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startX: number }>({
    onStart: (_, ctx) => {
      ctx.startX = translateX.value;
    },
    onActive: (event, ctx) => {
      const newTranslateX = ctx.startX + event.translationX;
      translateX.value = Math.min(0, Math.max(newTranslateX, SWIPE_THRESHOLD));
    },
    onEnd: () => {
      if (translateX.value < SWIPE_THRESHOLD / 2) {
        translateX.value = withTiming(SWIPE_THRESHOLD);
      } else {
        translateX.value = withTiming(0);
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleDelete = () => {
    onDelete();
    translateX.value = withTiming(0);
  };

  return (
    <View style={styles.container}>
      <View style={styles.deleteAction}>
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={24} color="#fff" />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.content, animatedStyle]}>
          {children}
        </Animated.View>
      </PanGestureHandler>
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
    width: SWIPE_THRESHOLD,
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
