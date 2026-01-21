import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Animated, PanResponder } from 'react-native';
import { SCREEN_WIDTH } from '../constants/dimensions';
import { useInteractionStore } from '../state/interactions';
import { useAuthStore } from '../state/auth';
import type { Item } from '../types';
import { sendInteraction } from '../lib/api';
import { updateModel } from '../lib/recommender';

export function useSwipeAnimations(
    items: Item[], 
    onShowDetails: (item: Item) => void,
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [lastSwipeDirection, setLastSwipeDirection] = useState<'left' | 'right' | null>(null);
  
  const position = useRef(new Animated.ValueXY()).current;
  const nextCardAnimation = useRef(new Animated.Value(0.9)).current;
  
  const undoTimer = useRef<NodeJS.Timeout | null>(null);
  
  const { user } = useAuthStore();
  const pushInteraction = useInteractionStore((s) => s.pushInteraction);

  useEffect(() => {
    return () => {
      if (undoTimer.current) {
        clearTimeout(undoTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    setCurrentIndex(0);
    position.setValue({ x: 0, y: 0 });
    nextCardAnimation.setValue(0.9);
    setCanUndo(false);
    setLastSwipeDirection(null);
  }, [items]);

  const rotate = position.x.interpolate({ inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2], outputRange: ['-10deg', '0deg', '10deg'], extrapolate: 'clamp' });
  const likeOpacity = position.x.interpolate({ inputRange: [10, SCREEN_WIDTH / 4], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = position.x.interpolate({ inputRange: [-SCREEN_WIDTH / 4, -10], outputRange: [1, 0], extrapolate: 'clamp' });

  const onDecision = useCallback((decision: 'like' | 'dislike') => {
    if (isAnimating) return;
    const currentItem = items && items.length > 0 ? items[currentIndex] : null;
    if (!currentItem) return;

    setIsAnimating(true);
    setCanUndo(true);
    setLastSwipeDirection(decision === 'like' ? 'right' : 'left');
    pushInteraction({ itemId: currentItem.id, action: decision, at: Date.now(), tags: currentItem.tags, priceTier: currentItem.priceTier });
    sendInteraction(decision, currentItem.id, user?._id);
    updateModel(decision, currentItem);

    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
    }
    undoTimer.current = setTimeout(() => {
      setCanUndo(false);
      undoTimer.current = null;
    }, 3000);

    Animated.timing(nextCardAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const exitX = decision === 'like' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    Animated.timing(position, { toValue: { x: exitX, y: 0 }, duration: 300, useNativeDriver: false }).start(() => {
      position.setValue({ x: 0, y: 0 });
      nextCardAnimation.setValue(0.9);
      setCurrentIndex(prev => {
        if (!items || items.length === 0) return 0;
        return (prev + 1) % items.length;
      });
      setIsAnimating(false);
    });
  }, [isAnimating, items, currentIndex, pushInteraction, user, nextCardAnimation, position]);

  const undoSwipe = useCallback(() => {
    if (!canUndo) return;

    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }

    setIsAnimating(true);
    setCanUndo(false);
    
    const initialX = lastSwipeDirection === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    position.setValue({ x: initialX, y: 0 });

    setCurrentIndex(prev => prev - 1);

    Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false
    }).start(() => {
        setIsAnimating(false);
    });
  }, [canUndo, lastSwipeDirection]);

  const showDetailsAnimation = useCallback(() => {
      setIsDetailsVisible(true);
      Animated.spring(position, { toValue: { x: 0, y: -60 }, useNativeDriver: false }).start();
  }, [position]);

  const hideDetailsAnimation = useCallback(() => {
      setIsDetailsVisible(false);
      Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
  }, [position]);


    const panResponder = useMemo(() => 


      PanResponder.create({


        onStartShouldSetPanResponder: () => !isAnimating && !isDetailsVisible,


        onMoveShouldSetPanResponder: (_, gesture) => !isDetailsVisible && (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5),


        onPanResponderGrant: () => {


          position.extractOffset();


        },


        onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),


        onPanResponderRelease: (_, gesture) => {


          position.flattenOffset();


          if (isDetailsVisible) return;


  


          if (gesture.dx > 120) onDecision('like');


          else if (gesture.dx < -120) onDecision('dislike');


          else if (gesture.dy < -100) {


              const currentItem = items[currentIndex];


              if(currentItem) onShowDetails(currentItem);


          }


          else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();


        },


      }), 


      [isAnimating, isDetailsVisible, items, currentIndex, onDecision, onShowDetails]


    );

  return {
    currentIndex,
    position,
    nextCardAnimation,
    panResponder,
    animatedCardStyles: {
      transform: [...position.getTranslateTransform(), { rotate }],
    },
    likeOpacity,
    nopeOpacity,
    showDetailsAnimation,
    hideDetailsAnimation,
    isDetailsVisible,
    undoSwipe,
    canUndo,
    lastSwipeDirection,
  };
}