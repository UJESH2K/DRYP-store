import { View, Text, StyleSheet, Image, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl, FlatList, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../../src/lib/api';
import { useCartStore } from '../../src/state/cart';
import { useWishlistStore } from '../../src/state/wishlist';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.9:5000';
const { width: screenWidth } = Dimensions.get('window');

export default function ProductDetailScreen() {
    const { id } = useLocalSearchParams();
    const { cart, addToCart, removeFromCart } = useCartStore();
    const { addToWishlist, removeFromWishlist, isWishlisted } = useWishlistStore();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedOptions, setSelectedOptions] = useState({});
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isInCart, setIsInCart] = useState(false);

    const isProductInWishlist = isWishlisted(id as string);

    // Animation values
    const wishlistScale = useSharedValue(1);
    const cartScale = useSharedValue(1);
    const cartBgColor = useSharedValue('#000');

    // Animated styles
    const animatedWishlistStyle = useAnimatedStyle(() => ({
        transform: [{ scale: wishlistScale.value }],
    }));
    const animatedCartStyle = useAnimatedStyle(() => ({
        backgroundColor: withTiming(isInCart ? '#4B0082' : '#000', { duration: 300 }),
        transform: [{ scale: cartScale.value }],
    }));

    useEffect(() => {
        // Trigger wishlist animation
        wishlistScale.value = withSpring(isProductInWishlist ? 1.2 : 1, {}, (isFinished) => {
            if (isFinished) {
                wishlistScale.value = withSpring(1);
            }
        });
    }, [isProductInWishlist]);

    useEffect(() => {
        // Trigger cart animation
        cartScale.value = withSpring(isInCart ? 1.1 : 1, {}, (isFinished) => {
            if (isFinished) {
                cartScale.value = withSpring(1);
            }
        });
    }, [isInCart]);

    useEffect(() => {
        // Determine if the product/variant is in the cart
        if (product) {
            const hasVariants = product.options && product.options.length > 0;
            let inCart = false;
            if (hasVariants) {
                // For a product with variants, we can only determine if it's in the cart
                // if all options are selected.
                const allOptionsSelected = product.options.every(opt => selectedOptions[opt.name]);
                if (allOptionsSelected) {
                    const cartId = generateCartId(product._id, selectedOptions);
                    inCart = cart.some(item => item.id === cartId);
                }
            } else {
                // For a product without variants
                const cartId = generateCartId(product._id, undefined);
                inCart = cart.some(item => item.id === cartId);
            }
            setIsInCart(inCart);
        }
    }, [cart, product, selectedOptions]);
    
    useEffect(() => {
        const fetchProduct = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const productData = await apiCall(`/api/products/${id}`);
                setProduct(productData);
            } catch (error) {
                console.error("Failed to fetch product:", error);
                Alert.alert("Error", "Failed to load product details.");
            } finally {
                setLoading(false);
            }
        };
        fetchProduct();
    }, [id]);

    useEffect(() => {
        if (product?.variants?.length > 0) {
            const variant = product.variants.find(v =>
                Object.keys(selectedOptions).every(key => v.options[key] === selectedOptions[key])
            );
            setSelectedVariant(variant);
        }
    }, [selectedOptions, product]);

    const handleOptionSelect = (name, value) => {
        setSelectedOptions(prev => ({ ...prev, [name]: value }));
    };

    const generateCartId = (productId, options) => {
        if (!options || Object.keys(options).length === 0) return productId;
        const sortedOptions = Object.keys(options).sort().map(key => `${key}-${options[key]}`).join('_');
        return `${productId}_${sortedOptions}`;
    };
    
    const handleCartToggle = () => {
        if (!product) return;

        if (isInCart) {
            const cartId = generateCartId(product._id, product.options.length > 0 ? selectedOptions : undefined);
            removeFromCart(cartId);
        } else {
            const hasVariants = product.options && product.options.length > 0;
            if ((hasVariants && !selectedVariant) || (hasVariants && selectedVariant?.stock === 0) || (!hasVariants && product.stock === 0)) {
                return; // Button should be disabled, do nothing.
            }
            addToCart({
                productId: product._id,
                title: product.name,
                brand: product.brand,
                image: product.images[0],
                price: selectedVariant ? selectedVariant.price : product.basePrice,
                options: hasVariants ? selectedOptions : undefined,
                quantity: 1,
            });
        }
    };

    const handleWishlistToggle = () => {
        if (!product) return;
        if (isProductInWishlist) {
            removeFromWishlist(product._id);
        } else {
            addToWishlist(product);
        }
    };

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        router.back();
        // The timeout ensures the refresh indicator is visible for a moment
        setTimeout(() => setIsRefreshing(false), 500); 
    }, [router]);

    if (loading) {
        return <ActivityIndicator size="large" style={styles.centered} />;
    }

    if (!product) {
        return <View style={styles.centered}><Text>Product not found.</Text></View>;
    }

    const stockStatus = selectedVariant ? (selectedVariant.stock > 0 ? 'In Stock' : 'Out of Stock') : (product.stock > 0 ? 'In Stock' : 'Out of Stock');

    const renderProductContent = () => (
        <>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.imageCarousel}>
                {product.images.map((img, index) => (
                    <Image key={index} source={{ uri: `${API_BASE_URL}${img}` }} style={styles.productImage} />
                ))}
            </ScrollView>
            
            <View style={styles.detailsContainer}>
                <Text style={styles.brand}>{product.brand}</Text>
                <Text style={styles.name}>{product.name}</Text>
                <Text style={styles.price}>${(selectedVariant?.price || product.basePrice).toFixed(2)}</Text>
                <Text style={styles.description}>{product.description}</Text>

                {product.options.map(option => (
                    <View key={option.name} style={styles.optionContainer}>
                        <Text style={styles.optionTitle}>{option.name}</Text>
                        <View style={styles.optionButtons}>
                            {option.values.map(value => (
                                <Pressable key={value} style={[styles.optionButton, selectedOptions[option.name] === value && styles.optionButtonSelected]} onPress={() => handleOptionSelect(option.name, value)}>
                                    <Text style={[styles.optionText, selectedOptions[option.name] === value && styles.optionTextSelected]}>{value}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                ))}
                
                <Text style={stockStatus === 'In Stock' ? styles.stockIn : styles.stockOut}>{stockStatus}</Text>

                <View style={styles.actions}>
                    <Pressable onPress={handleWishlistToggle}>
                        <Animated.View style={[styles.wishlistButton, animatedWishlistStyle]}>
                            <Ionicons 
                                name={isProductInWishlist ? "heart" : "heart-outline"} 
                                size={30} 
                                color={isProductInWishlist ? "#FF6B6B" : "#000"} 
                            />
                        </Animated.View>
                    </Pressable>
                    <Animated.Pressable 
                        style={[styles.cartButton, animatedCartStyle]} 
                        onPress={handleCartToggle}
                        disabled={(product.options.length > 0 && !selectedVariant) || stockStatus === 'Out of Stock'}
                    >
                        <Ionicons name={isInCart ? "checkmark-done" : "cart-outline"} size={22} color="#fff" />
                        <Text style={styles.cartButtonText}>{isInCart ? 'Added to Cart' : 'Add to Cart'}</Text>
                    </Animated.Pressable>
                </View>
            </View>
        </>
    );

    return (
        <SafeAreaView style={styles.container}>
             <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </Pressable>
            </View>
            <FlatList
                data={[]}
                renderItem={null}
                keyExtractor={() => 'product-page'}
                ListHeaderComponent={renderProductContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor="#999"
                    />
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { 
        position: 'absolute', 
        top: 40, // Adjust for status bar
        left: 20,
        right: 20,
        zIndex: 1, 
        backgroundColor: 'transparent',
    },
    imageCarousel: { height: screenWidth * 1.2 }, 
    productImage: { width: screenWidth, height: screenWidth * 1.2, resizeMode: 'cover' },
    detailsContainer: { padding: 20 },
    brand: { fontSize: 16, color: '#888', marginBottom: 5, fontFamily: 'Zaloga' },
    name: { fontSize: 24, marginBottom: 10, fontFamily: 'Zaloga' },
    price: { fontSize: 22, marginBottom: 15, fontFamily: 'Zaloga' },
    description: { fontSize: 14, lineHeight: 22, color: '#666', fontFamily: 'Zaloga' },
    optionContainer: { marginBottom: 15 },
    optionTitle: { fontSize: 16, marginBottom: 10, fontFamily: 'Zaloga' },
    optionButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    optionButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' },
    optionButtonSelected: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
    optionText: { color: '#1a1a1a', fontFamily: 'Zaloga' },
    optionTextSelected: { color: '#fff' },
    stockIn: { fontSize: 16, color: '#10B981', marginBottom: 15, fontFamily: 'Zaloga' },
    stockOut: { fontSize: 16, color: '#EF4444', marginBottom: 15, fontFamily: 'Zaloga' },
    actions: { flexDirection: 'row', marginTop: 20, gap: 10, paddingBottom: 40 }, // Added paddingBottom
    wishlistButton: { 
        padding: 15, 
        borderRadius: 12, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    cartButton: { 
        flex: 1, 
        padding: 15, 
        borderRadius: 12, 
        backgroundColor: '#000', 
        justifyContent: 'center', 
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    cartButtonText: { color: '#fff', fontSize: 16, fontFamily: 'Zaloga' },
});
