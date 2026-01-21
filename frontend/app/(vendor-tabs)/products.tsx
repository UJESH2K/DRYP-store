import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  Button,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';
import { VendorHeader } from '../../src/components/vendor/Header';
import { useAuthStore } from '../../src/state/auth';
import { apiCall } from '../../src/lib/api';

import { AddProductForm } from '../../src/components/vendor/AddProductForm';

// --- Main Screen ---
export default function ManageProductsScreen() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useCustomRouter();
  const { user, isAuthenticated } = useAuthStore();

  const fetchProducts = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'vendor') return;
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/products?vendor=${user._id}`;
      if (searchQuery) {
        url += `&search=${searchQuery}`;
      }
      const data = await apiCall(url);
      if (Array.isArray(data)) setProducts(data);
      else throw new Error(data?.message || 'Failed to fetch products');
    } catch (err) { setError(err.message); } 
    finally { setIsLoading(false); }
  }, [isAuthenticated, user, searchQuery]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleProductAdded = (newProduct) => setProducts(prev => [newProduct, ...prev]);

  const handleDelete = (productId) => {
    Alert.alert(
      "Delete Product",
      "Are you sure you want to delete this product?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK", onPress: async () => {
            const result = await apiCall(`/api/products/${productId}`, { method: 'DELETE' });
            if (result.message === 'Product removed') {
              setProducts(prev => prev.filter(p => p._id !== productId));
            } else {
              Alert.alert('Error', result.message || 'Failed to delete product.');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.productItem}>
      <Image source={{ uri: item.images[0] }} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productDetails}>Price: ${item.basePrice.toFixed(2)}</Text>
        <Text style={styles.productDetails}>Stock: {item.variants.length > 0 ? item.variants.reduce((acc, v) => acc + v.stock, 0) : item.stock}</Text>
      </View>
      <Pressable onPress={() => router.push(`/vendor/edit-product?id=${item._id}`)}>
        <Ionicons name="pencil-outline" size={24} color="#1a1a1a" />
      </Pressable>
      <Pressable onPress={() => handleDelete(item._id)} style={{ marginLeft: 16 }}>
        <Ionicons name="trash-outline" size={24} color="red" />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <VendorHeader title="Manage Products" />
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={fetchProducts}
        />
      </View>
      <AddProductForm visible={isFormVisible} onClose={() => setIsFormVisible(false)} onProductAdded={handleProductAdded} />
      {isLoading ? <ActivityIndicator style={styles.centered} size="large" />
        : error ? <View style={styles.centered}><Text>{error}</Text><Pressable onPress={fetchProducts}><Text style={styles.retryText}>Retry</Text></Pressable></View>
        : <FlatList data={products} renderItem={renderItem} keyExtractor={item => item._id} contentContainerStyle={styles.listContent} ListEmptyComponent={<Text style={styles.emptyText}>No products yet.</Text>} onRefresh={fetchProducts} refreshing={isLoading} />}
      <Button
        title="Add Product"
        onPress={() => setIsFormVisible(true)}
        color="#0275d8"
      />
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 16,
    paddingHorizontal: 10,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    right: 20,
    bottom: 20,
    backgroundColor: '#0275d8',
    borderRadius: 28,
    elevation: 8,
  },
  listContent: { padding: 16 },
  productItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 16, borderRadius: 8, marginBottom: 12 },
  productImage: { width: 60, height: 60, borderRadius: 8, marginRight: 16 },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '600', fontFamily: 'Zaloga' },
  productDetails: { fontSize: 14, color: '#666666', marginTop: 4, fontFamily: 'Zaloga' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  retryText: { color: 'blue', marginTop: 10 },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#666666' },
});