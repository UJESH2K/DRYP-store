import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';
import { VendorHeader } from '../../src/components/vendor/Header';
import { useAuthStore } from '../../src/state/auth';
import { apiCall } from '../../src/lib/api';
import { formatPrice } from '../../src/utils/formatting';

import { AddProductForm } from '../../src/components/vendor/AddProductForm';

// --- Main Screen ---
export default function ManageProductsScreen() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Catalog import state
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [catalogPreview, setCatalogPreview] = useState(null);

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

  const handlePickCatalog = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setIsParsing(true);
      setCatalogPreview(null);

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);

      const preview = await apiCall('/api/vendors/me/catalog-preview', {
        method: 'POST',
        body: formData as any,
      });

      if (preview && preview.products && preview.products.length > 0) {
        setCatalogPreview({ ...preview, fileName: file.name });
      } else {
        Alert.alert('No Products Found', preview?.message || 'Could not parse any products from the file.');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to read file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleImportCatalog = async () => {
    if (!catalogPreview?.importId) return;
    setIsImporting(true);
    try {
      const result = await apiCall('/api/vendors/me/catalog-import', {
        method: 'POST',
        body: JSON.stringify({ importId: catalogPreview.importId }),
      });
      setCatalogPreview(null);
      Alert.alert('Import Complete', `${result.imported || 0} products imported successfully.`);
      fetchProducts();
    } catch (err) {
      Alert.alert('Import Failed', err.message || 'Something went wrong during import.');
    } finally {
      setIsImporting(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.productItem}>
      {item.images?.[0] ? (
        <Image source={{ uri: item.images[0] }} style={styles.productImage} />
      ) : (
        <View style={[styles.productImage, styles.noImagePlaceholder]}>
          <Ionicons name="image-outline" size={24} color="#ccc" />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productDetails}>Price: {formatPrice(item.basePrice ?? 0)}</Text>
        <Text style={styles.productDetails}>
          Stock: {item.variants?.length > 0
            ? item.variants.reduce((acc, v) => acc + (v.stock || 0), 0)
            : (item.stock || 0)}
        </Text>
        <View style={styles.likeBadge}>
          <Ionicons name="heart" size={14} color="#e0245e" />
          <Text style={styles.likeBadgeText}>{item.likes ?? 0} likes</Text>
        </View>
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

      {/* Catalog import (Excel / CSV) — vendor only */}
      {isAuthenticated && user?.role === 'vendor' && (
        <View style={styles.catalogActions}>
          <Pressable
            style={styles.catalogButton}
            onPress={handlePickCatalog}
            disabled={isParsing || isImporting}
          >
            {isParsing ? (
              <ActivityIndicator color="#0275d8" size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color="#0275d8" />
                <Text style={styles.catalogButtonText}>Upload Excel / CSV Catalog</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      <AddProductForm visible={isFormVisible} onClose={() => setIsFormVisible(false)} onProductAdded={handleProductAdded} />

      {isLoading ? (
        <ActivityIndicator style={styles.centered} size="large" />
      ) : error ? (
        <View style={styles.centered}>
          <Text>{error}</Text>
          <Pressable onPress={fetchProducts}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderItem}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No products yet.</Text>}
          onRefresh={fetchProducts}
          refreshing={isLoading}
        />
      )}

      <Pressable style={styles.fab} onPress={() => setIsFormVisible(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Catalog Preview Modal */}
      <Modal visible={!!catalogPreview} animationType="slide" onRequestClose={() => setCatalogPreview(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Catalog Preview</Text>
            <Pressable onPress={() => setCatalogPreview(null)}>
              <Ionicons name="close" size={28} color="#1a1a1a" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {catalogPreview && (
              <>
                <Text style={styles.previewFile}>File: {catalogPreview.fileName}</Text>
                <Text style={styles.previewCount}>
                  {catalogPreview.products.length} products ready to import
                </Text>
                {catalogPreview.skippedRows > 0 && (
                  <Text style={styles.previewNote}>
                    {catalogPreview.skippedRows} rows skipped (empty or unparseable)
                  </Text>
                )}
                {catalogPreview.parseErrors?.length > 0 && (
                  <Text style={styles.previewErrors}>
                    {catalogPreview.parseErrors.length} parse warning(s) — review before importing.
                  </Text>
                )}
                {catalogPreview.products.map((p, idx) => (
                  <View key={idx} style={styles.previewItem}>
                    <Text style={styles.previewName}>{p.name || 'Unnamed Product'}</Text>
                    <Text style={styles.previewDetail}>
                      Price: {formatPrice(p.basePrice ?? 0)}
                    </Text>
                    {p.variants?.length > 0 && (
                      <Text style={styles.previewDetail}>
                        {p.variants.length} variant(s)
                      </Text>
                    )}
                  </View>
                ))}
              </>
            )}
          </ScrollView>
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalBtn, styles.modalBtnCancel]}
              onPress={() => setCatalogPreview(null)}
            >
              <Text style={styles.modalBtnCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalBtn, styles.modalBtnImport, isImporting && styles.modalBtnDisabled]}
              onPress={handleImportCatalog}
              disabled={isImporting}
            >
              {isImporting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalBtnImportText}>
                  Import {catalogPreview?.products?.length ?? 0}
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F2E9' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 16,
    paddingHorizontal: 10,
    elevation: 2,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 40 },

  catalogActions: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  catalogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0275d8',
    elevation: 1,
  },
  catalogButtonText: {
    color: '#0275d8',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
    fontFamily: 'Zaloga',
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
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  productImage: { width: 60, height: 60, borderRadius: 8, marginRight: 16 },
  noImagePlaceholder: {
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '600', fontFamily: 'Zaloga' },
  productDetails: { fontSize: 14, color: '#666666', marginTop: 4, fontFamily: 'Zaloga' },
  likeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  likeBadgeText: { fontSize: 13, color: '#666666', fontFamily: 'Zaloga' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  retryText: { color: 'blue', marginTop: 10 },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#666666' },

  // Catalog preview modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 20, fontWeight: '600', fontFamily: 'Zaloga' },
  modalContent: { padding: 16, paddingBottom: 100 },
  previewFile: { fontSize: 14, color: '#666', fontFamily: 'Zaloga', marginBottom: 8 },
  previewCount: { fontSize: 18, fontWeight: '600', marginBottom: 12, fontFamily: 'Zaloga' },
  previewNote: { fontSize: 13, color: '#b58900', marginBottom: 6, fontFamily: 'Zaloga' },
  previewErrors: { fontSize: 13, color: '#b58900', marginBottom: 12, fontFamily: 'Zaloga' },
  previewItem: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  previewName: { fontSize: 15, fontWeight: '600', fontFamily: 'Zaloga' },
  previewDetail: { fontSize: 13, color: '#666', marginTop: 4, fontFamily: 'Zaloga' },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: { backgroundColor: '#f0f0f0', marginRight: 8 },
  modalBtnCancelText: { color: '#1a1a1a', fontWeight: '600', fontFamily: 'Zaloga' },
  modalBtnImport: { backgroundColor: '#0275d8', marginLeft: 8 },
  modalBtnImportText: { color: '#fff', fontWeight: '600', fontFamily: 'Zaloga' },
  modalBtnDisabled: { opacity: 0.6 },
});