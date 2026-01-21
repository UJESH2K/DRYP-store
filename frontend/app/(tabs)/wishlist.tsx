import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useCartStore } from '../../src/state/cart';
import { useWishlistStore } from '../../src/state/wishlist';
import { apiCall } from '../../src/lib/api';
import type { Item } from '../../src/types';
import { mapProductsToItems } from '../../src/utils/productMapping';
import AnimatedLoadingScreen from '../../src/components/common/AnimatedLoadingScreen';
import CustomAlert from '../../src/components/common/CustomAlert';
import ProductDetailModal from '../../src/components/ProductDetailModal';

export default function WishlistScreen() {
  const { items, setWishlist, removeFromWishlist } = useWishlistStore();
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCartStore();
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [alertInfo, setAlertInfo] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: { text: string; onPress: () => void; style?: 'cancel' | 'destructive' | 'default' }[];
  } | null>(null);

  const fetchWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const likedProducts = await apiCall('/api/wishlist');
      if (Array.isArray(likedProducts)) {
        setWishlist(likedProducts);
      } else {
        setWishlist([]);
      }
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
      setAlertInfo({
        visible: true,
        title: 'Error',
        message: 'Could not load your wishlist. Please try again later.',
        buttons: [{ text: 'OK', onPress: () => setAlertInfo(null) }]
      });
      setWishlist([]);
    } finally {
      setLoading(false);
    }
  }, [setWishlist]);

  // useFocusEffect will re-fetch data every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchWishlist();
    }, [fetchWishlist])
  );

  const handleAddToCart = (item: Item) => {
    setAlertInfo({
      visible: true,
      title: 'Add to Cart',
      message: `Add "${item.title}" to your cart and remove from wishlist?`,
      buttons: [
        { text: 'Cancel', style: 'cancel', onPress: () => setAlertInfo(null) },
        {
          text: 'Add',
          style: 'default',
          onPress: () => {
            setAlertInfo(null);
            try {
              addToCart({
                productId: item.id,
                title: item.title,
                price: item.price,
                image: item.image,
                brand: item.brand,
                quantity: 1,
              });
              removeFromWishlist(item.id);
            } catch (error) {
              console.error('Failed to add to cart:', error);
              setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'Failed to add item to cart',
                buttons: [{ text: 'OK', onPress: () => setAlertInfo(null) }]
              });
            }
          },
        },
      ]
    });
  };

  const handleRemoveFromWishlist = async (itemId: string, title: string) => {
    setAlertInfo({
      visible: true,
      title: 'Remove from Wishlist',
      message: `Are you sure you want to remove "${title}" from your wishlist?`,
      buttons: [
        { text: 'Cancel', style: 'cancel', onPress: () => setAlertInfo(null) },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setAlertInfo(null); // Dismiss confirmation alert
            removeFromWishlist(itemId);
          },
        },
      ]
    });
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  const renderWishlistItem = ({ item }: { item: Item }) => (
    <Pressable onPress={() => {
      setSelectedProductId(item.id);
      setIsModalVisible(true);
    }}>
      <View style={styles.itemContainer}>
        <Image source={{ uri: item.image }} style={styles.itemImage} />
        <View style={styles.itemDetails}>
          <Text style={styles.itemBrand}>{item.brand}</Text>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
          <View style={styles.itemActions}>
            <Pressable onPress={() => handleAddToCart(item)} style={styles.addToCartButton}>
              <Text style={styles.addToCartText}>Add to Cart</Text>
            </Pressable>
            <Pressable onPress={() => handleRemoveFromWishlist(item.id, item.title)} style={styles.removeButton}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );

  const mappedItems = mapProductsToItems(items);

  if (loading) {
    return <AnimatedLoadingScreen text="Loading your wishlist..." />;
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.header}><Text style={styles.headerTitle}>My Wishlist</Text></View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySubtitle}>Items you like will appear here.</Text>
          <Pressable onPress={() => router.push('/(tabs)/home')} style={styles.discoverButton}>
            <Text style={styles.discoverText}>Discover Items</Text>
          </Pressable>
        </View>
        {alertInfo && (
          <CustomAlert
            visible={alertInfo.visible}
            title={alertInfo.title}
            message={alertInfo.message}
            buttons={alertInfo.buttons}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Wishlist</Text>
        </View>
        <FlatList
          data={mappedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderWishlistItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
      <ProductDetailModal
        productId={selectedProductId}
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
      />
      {alertInfo && (
        <CustomAlert
          visible={alertInfo.visible}
          title={alertInfo.title}
          message={alertInfo.message}
          buttons={alertInfo.buttons}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 28,
    color: '#1a1a1a',
    textAlign: 'left',
    fontFamily: 'Zaloga',
  },
  listContainer: {
    padding: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  itemImage: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  itemBrand: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
    fontFamily: 'Zaloga',
  },
  itemTitle: {
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 4,
    fontFamily: 'Zaloga',
  },
  itemPrice: {
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 10,
    fontFamily: 'Zaloga',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 10,
  },
  addToCartButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addToCartText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Zaloga',
  },
  removeButton: {
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontFamily: 'Zaloga',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Zaloga',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: 'Zaloga',
  },
  discoverButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 100,
  },
  discoverText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Zaloga',
  },
});