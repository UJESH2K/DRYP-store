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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../src/lib/api';
import type { Item } from '../src/types';
import { mapProductsToItems } from '../src/utils/productMapping';
import AnimatedLoadingScreen from '../src/components/common/AnimatedLoadingScreen';

// This screen shows items the user has 'liked' for recommendation purposes
export default function LikedItemsScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLikedItems = useCallback(async () => {
    setLoading(true);
    try {
      const likedProducts = await apiCall('/api/likes');
      if (Array.isArray(likedProducts)) {
        const mappedItems = mapProductsToItems(likedProducts);
        setItems(mappedItems);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Failed to fetch liked items:', error);
      Alert.alert('Error', 'Could not load your liked items. Please try again later.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLikedItems();
    }, [fetchLikedItems])
  );

  const handleUnlike = async (itemId: string, title: string) => {
    Alert.alert(
      'Remove from Liked Items',
      `This will affect your recommendations. Unlike "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlike',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await apiCall(`/api/likes/${itemId}`, { method: 'DELETE' });
              if (result && result.success) {
                setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
              } else {
                throw new Error(result?.message || 'Failed to unlike item.');
              }
            } catch (error) {
              console.error('Failed to unlike item:', error);
              Alert.alert('Error', 'Could not unlike item. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Item }) => (
    <View style={styles.itemContainer}>
      <Image source={{ uri: item.image }} style={styles.itemImage} />
      <View style={styles.itemDetails}>
        <Text style={styles.itemBrand}>{item.brand}</Text>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Pressable onPress={() => handleUnlike(item.id, item.title)} style={styles.unlikeButton}>
          <Text style={styles.unlikeButtonText}>Unlike</Text>
        </Pressable>
      </View>
    </View>
  );

  if (loading) {
    return <AnimatedLoadingScreen text="Loading your liked items..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-dislike-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>No Liked Items Yet</Text>
            <Text style={styles.emptySubtitle}>Swipe right on products you love, and they'll appear here!</Text>
            <Pressable onPress={() => router.push('/(tabs)/home')} style={styles.discoverButton}>
              <Text style={styles.discoverButtonText}>Discover Now</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
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
        elevation: 3,
        alignItems: 'center',
    },
    itemImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        marginRight: 16,
    },
    itemDetails: {
        flex: 1,
    },
    itemBrand: {
        fontSize: 14,
        color: '#888',
        fontFamily: 'Zaloga',
    },
    itemTitle: {
        fontSize: 18,
        color: '#1a1a1a',
        fontFamily: 'Zaloga',
        marginVertical: 4,
    },
    unlikeButton: {
        alignSelf: 'flex-start',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#f8d7da',
    },
    unlikeButtonText: {
        color: '#dc3545',
        fontSize: 14,
        fontFamily: 'Zaloga',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        minHeight: 300, // Ensure it takes up enough space
        marginTop: 50,
    },
    emptyTitle: {
        fontSize: 22,
        fontFamily: 'Zaloga',
        color: '#1a1a1a',
        textAlign: 'center',
        marginBottom: 12,
        marginTop: 20,
    },
    emptySubtitle: {
        fontSize: 16,
        fontFamily: 'Zaloga',
        color: '#6c757d',
        textAlign: 'center',
        marginBottom: 32,
    },
    discoverButton: {
      backgroundColor: '#1a1a1a',
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 100,
    },
    discoverButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontFamily: 'Zaloga',
    },
});