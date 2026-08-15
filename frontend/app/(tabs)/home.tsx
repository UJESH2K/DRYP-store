import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHomeScreenData } from '../../src/hooks/useHomeScreenData';
import { useSwipeAnimations } from '../../src/hooks/useSwipeAnimations';
import { useCartStore } from '../../src/state/cart';
import { useToastStore } from '../../src/state/toast';
import { Header } from '../../src/components/home/Header';
import { Filters } from '../../src/components/home/Filters';
import AnimatedLoadingScreen from '../../src/components/common/AnimatedLoadingScreen';
import { EmptyState } from '../../src/components/home/EmptyState';
import { Card } from '../../src/components/home/Card';
import ProductDetailModal from '../../src/components/ProductDetailModal';
import AIStylistSheet from '../../src/components/AIStylistSheet';
import ZalogaFAB from '../../src/components/stylist/ZalogaFAB';
import { Item } from '../../src/types';

export default function HomeScreen() {
  const {
    items,
    loading,
    error,
    filters,
    selectedFilters,
    setSelectedFilters,
    clearFilters,
    loadMore,
    loadingMore,
    endReached,
  } = useHomeScreenData();
  
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const [showStylist, setShowStylist] = useState(false);
  const addToCart = useCartStore((s) => s.addToCart);
  const showToast = useToastStore((s) => s.showToast);

  const showDetailsWithAnimation = (item: Item) => {
    swipeAnimations.showDetailsAnimation();
    setSelectedProductId(item.id);
    setModalVisible(true);
  };

  const addToCartWithFeedback = (item: Item) => {
    addToCart({
      productId: item.id,
      title: item.title,
      brand: item.brand,
      image: item.image,
      price: item.price,
      options: undefined,
      quantity: 1,
    });
    showToast(`Added ${item.title} to cart`, 'success');
  };
  
  const hideDetailsWithAnimation = () => {
    swipeAnimations.hideDetailsAnimation();
    setModalVisible(false);
    setSelectedProductId(null);
  };
  
  const swipeAnimations = useSwipeAnimations(items, showDetailsWithAnimation, addToCartWithFeedback);
  const undoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timer;
    if (swipeAnimations.canUndo) {
      Animated.timing(undoOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      timer = setTimeout(() => {
        Animated.timing(undoOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 3000); // 3 seconds
    } else {
      Animated.timing(undoOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    return () => clearTimeout(timer);
  }, [swipeAnimations.canUndo, swipeAnimations.currentIndex]);

  const currentItem = items[swipeAnimations.currentIndex];
  // Infinite scroll: fetch the next batch when the deck runs low.
  useEffect(() => {
    if (loading || loadingMore || endReached) return;
    if (items.length === 0) return;
    if (swipeAnimations.currentIndex >= items.length - 5) {
      loadMore();
    }
  }, [swipeAnimations.currentIndex, items.length, loading, loadingMore, endReached, loadMore]);

  // FIX: Remove the modulo so the stack actually ends when it runs out of items
  const nextItem = items[swipeAnimations.currentIndex + 1];

  if (loading) {
    return <AnimatedLoadingScreen text="Finding your next look..." />;
  }

  if (items.length === 0) {
    return <EmptyState onClearFilters={clearFilters} error={error} />;
  }

  return (
    <>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Header onAIStylistPress={() => setShowStylist(true)} />
        <Filters 
          filters={filters}
          selectedFilters={selectedFilters}
          onSelectionChange={setSelectedFilters}
        />
        <View style={styles.cardStack}>
          {/* Add this fallback message behind the cards */}
          {swipeAnimations.currentIndex >= items.length && (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22, fontFamily: 'Zaloga', marginBottom: 8 }}>{loadingMore || !endReached ? 'Finding more styles…' : "You're all caught up!"}</Text>
              <Text style={{ fontSize: 16, color: '#666', fontFamily: 'Zaloga' }}>{endReached ? 'Check back later for new styles.' : 'Loading more styles…'}</Text>
            </View>
          )}
          {nextItem && (
            <Card 
              item={nextItem}
              style={{
                opacity: 0.8,
                transform: [
                  { scale: swipeAnimations.nextCardAnimation },
                  {
                    translateY: swipeAnimations.nextCardAnimation.interpolate({
                      inputRange: [0.9, 1],
                      outputRange: [40, 0],
                    }),
                  },
                ],
              }}
              isNext
            />
          )}
          {currentItem && (
            <Card 
              item={currentItem}
              style={swipeAnimations.animatedCardStyles}
              likeOpacity={swipeAnimations.likeOpacity}
              nopeOpacity={swipeAnimations.nopeOpacity}
              panHandlers={swipeAnimations.panResponder.panHandlers}
            />
          )}
        </View>
        
        {/* Undo Button */}
        <Animated.View style={[styles.undoContainer, { opacity: undoOpacity }]}>
          <Pressable 
            style={styles.undoButton} 
            onPress={swipeAnimations.undoSwipe}
            disabled={!swipeAnimations.canUndo}
          >
            <Text style={styles.undoButtonText}>Undo</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
      
      {selectedProductId && (
        <ProductDetailModal
          productId={selectedProductId}
          isVisible={isModalVisible}
          onClose={hideDetailsWithAnimation}
        />
      )}

      <ZalogaFAB
        visible={true}
        onPress={() => setShowStylist(true)}
      />

      <AIStylistSheet
        visible={showStylist}
        onClose={() => setShowStylist(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F7F2E9' 
  },
  cardStack: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  undoContainer: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  undoButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  undoButtonText: {
    fontFamily: 'Zaloga',
    fontSize: 16,
    color: '#007AFF',
  }
});
