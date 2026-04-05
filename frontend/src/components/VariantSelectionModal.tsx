import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  FlatList,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../lib/api';
import { useCartStore, CartItem } from '../../src/state/cart';
import { Product, ProductOption, ProductVariant } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VariantSelectionModalProps {
  cartItem: CartItem | null;
  isVisible: boolean;
  onClose: () => void;
}

const VariantSelectionModal: React.FC<VariantSelectionModalProps> = ({ cartItem, isVisible, onClose }) => {
  const { updateCartItem } = useCartStore();
  const insets = useSafeAreaInsets();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [displayImages, setDisplayImages] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [isSizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const [isColorDropdownOpen, setColorDropdownOpen] = useState(false);

  const detailsPosition = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (isVisible && cartItem) {
      setLoading(true);
      fetchProductDetails(cartItem.productId);
      if (cartItem.options?.Size) setSelectedSize(cartItem.options.Size);
      if (cartItem.options?.Color) setSelectedColor(cartItem.options.Color);
      Animated.spring(detailsPosition, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    } else if (!isVisible) {
      Animated.spring(detailsPosition, { toValue: SCREEN_HEIGHT, useNativeDriver: true, bounciness: 0 }).start(() => {
        setProduct(null);
        setSelectedVariant(null);
        setDisplayImages([]);
        setSelectedSize(null);
        setSelectedColor(null);
      });
    }
  }, [isVisible, cartItem]);

  useEffect(() => {
    if (product) {
      const variant = product.variants?.find(v => 
        (!v.options.Size || v.options.Size === selectedSize) && 
        (!v.options.Color || v.options.Color === selectedColor)
      );
      setSelectedVariant(variant || null);
    }
  }, [product, selectedSize, selectedColor]);

  const fetchProductDetails = async (id: string) => {
    try {
      const productData: Product = await apiCall(`/api/products/${id}`);
      if (productData) {
        setProduct(productData);
      }
    } catch (error) {
      console.error('Failed to fetch product details:', error);
      Alert.alert('Error', 'Failed to load product details.');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
    setSizeDropdownOpen(false);
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    if (product) {
      const variantWithColor = product.variants?.find(v => v.options.Color === color);
      if (variantWithColor && variantWithColor.images && variantWithColor.images.length > 0) {
        setDisplayImages(variantWithColor.images);
      } else {
        setDisplayImages(product.images || []);
      }
    }
    setColorDropdownOpen(false);
  };

  const formatPrice = useCallback((price: number | undefined | null) => {
    const numericPrice = Number(price);
    if (isNaN(numericPrice)) return '$0.00';
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(numericPrice);
    } catch (e) {
      return `$${(numericPrice || 0).toFixed(2)}`;
    }
  }, []);

  const handleConfirm = () => {
    if (!cartItem || !product || !selectedVariant) {
      Alert.alert('Error', 'Please select a valid variant.');
      return;
    }

    const price = selectedVariant?.price ?? product.basePrice;
    if (typeof price !== 'number' || isNaN(price)) {
      Alert.alert('Error', 'Invalid price. Cannot update cart.');
      return;
    }

    updateCartItem(cartItem.id, {
      productId: product._id,
      title: product.name,
      brand: product.brand,
      image: selectedVariant.images?.[0] || product.images[0],
      price: price,
      options: { 
        ...(selectedSize ? { Size: selectedSize } : {}),
        ...(selectedColor ? { Color: selectedColor } : {})
      },
    });
    onClose();
  };
  
  if (!isVisible) return null;
  
  return (
    <Animated.View style={[styles.detailsView, { transform: [{ translateY: detailsPosition }] }]} accessibilityViewIsModal>
      <Pressable onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close-circle" size={36} color="#333" />
      </Pressable>
      
      {loading || !product ? (
        <ActivityIndicator size="large" style={styles.centered} />
      ) : (
        <>
          <ScrollView contentContainerStyle={[styles.detailsContent, { paddingBottom: 24 + (insets.bottom || 0) + 80 }]} showsVerticalScrollIndicator={true}>
            <View style={styles.detailsInfoSection}>
              <Text style={styles.detailsBrand}>{product.brand}</Text>
              <Text style={styles.detailsTitle}>{product.name}</Text>

              {/* Size Dropdown */}
              <View style={styles.optionContainer}>
                <Text style={styles.optionTitle}>Size</Text>
                <Pressable style={styles.dropdown} onPress={() => setSizeDropdownOpen(true)}>
                  <Text style={styles.dropdownText}>{selectedSize || 'Select Size'}</Text>
                  <Ionicons name="chevron-down" size={16} color="black" />
                </Pressable>
              </View>

              {/* Color Dropdown */}
              <View style={styles.optionContainer}>
                <Text style={styles.optionTitle}>Color</Text>
                <Pressable style={styles.dropdown} onPress={() => setColorDropdownOpen(true)}>
                  <Text style={styles.dropdownText}>{selectedColor || 'Select Color'}</Text>
                  <Ionicons name="chevron-down" size={16} color="black" />
                </Pressable>
              </View>

              {selectedVariant && (
                <Text style={selectedVariant.stock > 0 ? styles.stockIn : styles.stockOut}>
                  {selectedVariant.stock > 0 ? 'In Stock' : 'Out of Stock'}
                </Text>
              )}

              <Text style={styles.detailsPrice}>{formatPrice(selectedVariant?.price ?? product.basePrice)}</Text>
            </View>
          </ScrollView>

          {/* Size Modal */}
          <Modal visible={isSizeDropdownOpen} transparent={true} animationType="slide">
            <Pressable style={styles.modalBackdrop} onPress={() => setSizeDropdownOpen(false)}>
              <View style={styles.modalContent}>
                <FlatList
                  data={product.options?.find((opt: ProductOption) => opt.name === 'Size')?.values || []}
                  renderItem={({ item }) => (
                    <Pressable style={styles.modalItem} onPress={() => handleSizeSelect(item)}>
                      <Text>{item}</Text>
                    </Pressable>
                  )}
                  keyExtractor={item => item}
                />
              </View>
            </Pressable>
          </Modal>

          {/* Color Modal */}
          <Modal visible={isColorDropdownOpen} transparent={true} animationType="slide">
            <Pressable style={styles.modalBackdrop} onPress={() => setColorDropdownOpen(false)}>
              <View style={styles.modalContent}>
                <FlatList
                  data={product.options?.find((opt: ProductOption) => opt.name === 'Color')?.values || []}
                  renderItem={({ item }) => (
                    <Pressable style={styles.modalItem} onPress={() => handleColorSelect(item)}>
                      <Text>{item}</Text>
                    </Pressable>
                  )}
                  keyExtractor={item => item}
                />
              </View>
            </Pressable>
          </Modal>

          <View style={[styles.detailsActions, { paddingBottom: insets.bottom || 12 }]}>
            <Pressable style={[styles.detailsButton, { flex: 1 }]} onPress={handleConfirm} disabled={!selectedVariant}>
              <Text style={styles.detailsButtonText}>Confirm</Text>
            </Pressable>
          </View>
        </>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  detailsView: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '95%', backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 20, paddingTop: 20 },
  closeButton: { position: 'absolute', top: 10, right: 10, zIndex: 10, padding: 10 },
  detailsContent: { paddingBottom: 40 },
  detailsInfoSection: { padding: 20 },
  detailsBrand: { fontSize: 16, color: '#888', marginBottom: 5 },
  detailsTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  detailsPrice: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 15 },
  optionContainer: { marginBottom: 15 },
  optionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  stockIn: { fontSize: 16, color: '#10B981', fontWeight: '600', marginBottom: 15 },
  stockOut: { fontSize: 16, color: '#EF4444', fontWeight: '600', marginBottom: 15 },
  detailsActions: { flexDirection: 'row', padding: 20, gap: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  detailsButton: { padding: 15, borderRadius: 15, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  detailsButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  dropdownText: { fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', borderRadius: 8, padding: 16, width: '80%', maxHeight: '50%' },
  modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
});

export default VariantSelectionModal;