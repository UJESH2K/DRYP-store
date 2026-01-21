import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  StatusBar,
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../../src/lib/api';
import { rankItems } from '../../src/lib/recommender';
import type { Item } from '../../src/types';
import { mapProductsToItems } from '../../src/utils/productMapping';
import ProductDetailModal from '../../src/components/ProductDetailModal';
import Filters from '../../src/components/Filters';
import AnimatedLoadingScreen from '../../src/components/common/AnimatedLoadingScreen';
import { useCacheStore } from '../../src/state/cache';
import { formatPrice } from '../../src/utils/formatting';

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [trending, setTrending] = useState<Item[]>([]);
  
  const [brands, setBrands] = useState<string[]>((cachedBrands && cachedBrands.data) || []);
  const [categories, setCategories] = useState<string[]>((cachedCategories && cachedCategories.data) || []);
  const [colors, setColors] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Item[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  
  const [selectedProductIdForModal, setSelectedProductIdForModal] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const {
    categories: cachedCategories,
    brands: cachedBrands,
    recentSearches,
    setCategories: setCachedCategories,
    setBrands: setCachedBrands,
    setRecentSearches,
  } = useCacheStore();

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery.length > 0 && isTyping) {
        fetchSuggestions();
      } else {
        setSuggestions([]);
      }
    }, 300); // 300ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, isTyping]);

  const fetchSuggestions = async () => {
    try {
      const data = await apiCall(`/api/products/suggestions?query=${searchQuery}`);
      if (Array.isArray(data)) {
        setSuggestions(data);
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    }
  };
  
  const fetchInitialData = async () => {
    try {
      const now = Date.now();
      
      const productsPromise = apiCall('/api/products?limit=20');

      const brandsPromise = 
        cachedBrands?.timestamp && now - cachedBrands.timestamp < CACHE_DURATION
        ? Promise.resolve(cachedBrands.data)
        : apiCall('/api/products/brands').then(data => {
            if(Array.isArray(data)) setCachedBrands(data);
            return data;
          });
      
      const categoriesPromise =
        cachedCategories?.timestamp && now - cachedCategories.timestamp < CACHE_DURATION
        ? Promise.resolve(cachedCategories.data)
        : apiCall('/api/products/categories').then(data => {
            if(Array.isArray(data)) setCachedCategories(data);
            return data;
          });

      const colorsPromise = apiCall('/api/products/colors');

      const [products, fetchedBrands, fetchedCategories, fetchedColors] = await Promise.all([
        productsPromise,
        brandsPromise,
        categoriesPromise,
        colorsPromise,
      ]);

      if (Array.isArray(products)) {
        const items = mapProductsToItems(products);
        setTrending(items.slice(0, 10));
        setRecommendations(rankItems(items).slice(0, 10));
      }
      if (Array.isArray(fetchedBrands)) setBrands(fetchedBrands);
      if (Array.isArray(fetchedCategories)) setCategories(fetchedCategories);
      if (Array.isArray(fetchedColors)) setColors(fetchedColors);

    } catch (error) { console.error("Failed to fetch initial data:", error); }
    finally { setInitialLoading(false); }
  };

  const fetchData = useCallback(async () => {
    setIsSearching(true);
    setResults([]);
    let endpoint = '/api/products?';
    const params = new URLSearchParams();

    if (searchQuery) params.append('search', searchQuery);
    if (selectedBrand) params.append('brand', selectedBrand);
    if (selectedCategory) params.append('category', selectedCategory);
    if (selectedColor) params.append('color', selectedColor);
    if (minPrice) params.append('minPrice', minPrice);
    if (maxPrice) params.append('maxPrice', maxPrice);

    endpoint += params.toString();

    try {
      const products = await apiCall(endpoint);
      const items = Array.isArray(products) ? mapProductsToItems(products) : [];
      setResults(items);
      if (searchQuery && items.length > 0) {
        const newSearch = { query: searchQuery, image: items[0].image };
        const updatedSearches = [newSearch, ...recentSearches.filter(rs => rs.query !== searchQuery)];
        setRecentSearches(updatedSearches.slice(0, 5));
      }
    } catch (error) { console.error("Failed to fetch data:", error); } 
    finally { setIsSearching(false); }
  }, [searchQuery, selectedBrand, selectedCategory, selectedColor, minPrice, maxPrice, recentSearches, setRecentSearches]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setIsTyping(true);
  };
  
  const applyFilters = () => {
    const noFiltersApplied = !selectedBrand && !selectedCategory && !selectedColor && !minPrice && !maxPrice;
    if (noFiltersApplied) {
        setResults([]);
        setSearchQuery('');
    } else {
        fetchData();
    }
    setAreFiltersVisible(false);
  };

  const clearFilters = () => {
    setSelectedBrand(null);
    setSelectedCategory(null);
    setSelectedColor(null);
    setMinPrice('');
    setMaxPrice('');
    setResults([]);
    setSearchQuery('');
    setAreFiltersVisible(false);
  };

  const closeFilters = () => {
    setAreFiltersVisible(false);
  };

  const areAnyFiltersApplied = !!(selectedBrand || selectedCategory || selectedColor || minPrice || maxPrice);

  // UI Rendering
  const renderProductCard = ({ item, large = false }: { item: Item, large?: boolean }) => (
    <Pressable style={large ? styles.largeProductCard : styles.productCard} onPress={() => {
      setSelectedProductIdForModal(item.id);
      setIsModalVisible(true);
    }}>
      <Image source={{ uri: item.image }} style={large ? styles.largeProductImage : styles.productImage} />
      <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.productBrand} numberOfLines={1}>{item.brand}</Text>
      <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
    </Pressable>
  );
  
  if (initialLoading) {
    return <AnimatedLoadingScreen text="Searching for inspiration..." />;
  }

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View 
          style={styles.header}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            setHeaderHeight(height);
          }}
        >
          <View style={styles.searchBarContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              value={searchQuery}
              onChangeText={handleSearchChange}
              onSubmitEditing={fetchData}
            />
            {searchQuery.length > 0 ? (
                <Pressable onPress={() => {
                    setSearchQuery('');
                    setResults([]);
                    setSuggestions([]);
                }} style={styles.searchIcon}>
                    <Ionicons name="close" size={24} color="#888" />
                </Pressable>
            ) : (
                <Pressable onPress={fetchData} style={styles.searchIcon}>
                    <Ionicons name="search" size={24} color="#888" />
                </Pressable>
            )}
          </View>
          <Pressable onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setAreFiltersVisible(!areFiltersVisible);
          }}>
            <Ionicons name="options-outline" size={28} color="#000" style={{marginLeft: 10}} />
          </Pressable>
        </View>

        {areAnyFiltersApplied && !areFiltersVisible && (
            <View style={styles.clearFiltersContainer}>
                <Pressable onPress={clearFilters} style={styles.clearFiltersButton}>
                    <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
                    <Ionicons name="close" size={16} color="#000" style={{ marginLeft: 5 }} />
                </Pressable>
            </View>
        )}

        {suggestions.length > 0 && (
            <FlatList
                data={suggestions}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                    <Pressable style={styles.suggestionItem} onPress={() => {
                        setSearchQuery(item);
                        setIsTyping(false);
                        setSuggestions([]);
                        fetchData();
                    }}>
                        <Text style={styles.suggestionText}>{item}</Text>
                    </Pressable>
                )}
                style={styles.suggestionsContainer}
            />
        )}
        
        {!areFiltersVisible && suggestions.length === 0 && (
          <FlatList
            data={[
              { type: 'recent-searches', data: recentSearches, title: 'Recent Searches' },
              { type: 'search-results', data: results, title: 'Search Results' },
              { type: 'trending', data: trending, title: 'Trending Now' },
              { type: 'recommendations', data: recommendations, title: 'You Might Also Like' },
            ]}
            keyExtractor={(item) => item.type}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            renderItem={({ item }) => {
              if (isSearching && (item.type === 'search-results')) {
                return <ActivityIndicator size="large" style={{marginTop: 50}} />;
              }

              if (item.type === 'recent-searches' && recentSearches.length > 0 && results.length === 0 && searchQuery.length < 3) {
                return (
                  <View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.sectionTitle}>{item.title}</Text>
                        <Pressable onPress={() => setRecentSearches([])}>
                            <Text style={{ color: 'gray', paddingRight: 20 }}>Clear</Text>
                        </Pressable>
                    </View>
                    <FlatList
                      horizontal
                      data={item.data}
                      renderItem={({ item: recentSearch }) => (
                        <Pressable style={styles.recentSearchCard} onPress={() => {
                          setSearchQuery(recentSearch.query);
                          fetchData();
                        }}>
                          <Image source={{ uri: recentSearch.image }} style={styles.recentSearchImage} />
                          <Text style={styles.recentSearchTitle}>{recentSearch.query}</Text>
                        </Pressable>
                      )}
                      keyExtractor={(recentSearch) => recentSearch.query}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 20 }}
                    />
                  </View>
                );
              }

              if (item.type === 'search-results' && (results.length > 0 || searchQuery.length > 2)) {
                return (
                  <>
                    <Text style={styles.sectionTitle}>{item.title}</Text>
                    <FlatList
                      data={results}
                      renderItem={({item}) => renderProductCard({item, large: false})}
                      keyExtractor={(item) => item.id.toString()}
                      numColumns={2}
                      columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 20 }}
                      ListEmptyComponent={<Text style={styles.emptyText}>No products found for your search.</Text>}
                    />
                  </>
                );
              }

              if ((item.type === 'trending' || item.type === 'recommendations') && (results.length === 0 && searchQuery.length < 3)) {
                return (
                  <View style={item.type === 'recommendations' ? {marginTop: 20} : {}}>
                    <Text style={styles.sectionTitle}>{item.title}</Text>
                    <FlatList
                      horizontal
                      data={item.data as Item[]}
                      renderItem={({item: product}) => renderProductCard({item: product, large: true})}
                      keyExtractor={(product) => `${item.type}-${product.id}`}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 20 }}
                    />
                  </View>
                );
              }
              
              return null;
            }}
            ListFooterComponent={<View style={{height: 40}} />}
          />
        )}
      </SafeAreaView>
      
      {areFiltersVisible && (
        <Filters
          headerHeight={headerHeight}
          insets={insets}
          closeFilters={closeFilters}
          minPrice={minPrice}
          setMinPrice={setMinPrice}
          maxPrice={maxPrice}
          setMaxPrice={setMaxPrice}
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          brands={brands}
          selectedBrand={selectedBrand}
          setSelectedBrand={setSelectedBrand}
          colors={colors}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          clearFilters={clearFilters}
          applyFilters={applyFilters}
        />
      )}
      
      <ProductDetailModal
        productId={selectedProductIdForModal}
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#ffffff' 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eaeaea' 
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  searchInput: { 
    flex: 1, 
    fontSize: 16, 
    paddingRight: 10, 
    fontFamily: 'Zaloga' 
  },
  searchIcon: { 
    paddingLeft: 10 
  },
  sectionTitle: { 
    fontSize: 20, 
    color: '#000', 
    marginVertical: 15, 
    paddingHorizontal: 20, 
    fontFamily: 'Zaloga' 
  },
  emptyText: { 
    textAlign: 'center', 
    marginTop: 20, 
    fontSize: 16, 
    color: '#666' 
  },
  productCard: { 
    width: '48%', 
    marginBottom: 20 
  },
  productImage: { 
    width: '100%', 
    aspectRatio: 0.8, 
    borderRadius: 10, 
    backgroundColor: '#f5f5f5' 
  },
  largeProductCard: { 
    width: 180, 
    marginRight: 15 
  },
  largeProductImage: { 
    width: '100%', 
    height: 220, 
    borderRadius: 10, 
    backgroundColor: '#f5f5f5' 
  },
  productTitle: { 
    fontSize: 14, 
    color: '#1a1a1a', 
    marginTop: 10, 
    fontFamily: 'Zaloga' 
  },
  productBrand: { 
    fontSize: 12, 
    color: '#888', 
    marginVertical: 2, 
    fontFamily: 'Zaloga' 
  },
  productPrice: { 
    fontSize: 14, 
    color: '#1a1a1a', 
    marginTop: 4, 
    fontFamily: 'Zaloga' 
  },
  clearFiltersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  clearFiltersButtonText: {
    fontFamily: 'Zaloga',
    fontSize: 14,
  },
  suggestionsContainer: {
    backgroundColor: 'white',
    borderRadius: 5,
    marginHorizontal: 20,
  },
  suggestionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  suggestionText: {
    fontSize: 16,
    fontFamily: 'Zaloga',
  },
  recentSearchCard: { 
    width: 120, 
    marginRight: 15 
  },
  recentSearchImage: { 
    width: '100%', 
    height: 120, 
    borderRadius: 10, 
    backgroundColor: '#f5f5f5' 
  },
  recentSearchTitle: { 
    fontSize: 14, 
    color: '#1a1a1a', 
    marginTop: 10, 
    fontFamily: 'Zaloga' 
  },
});