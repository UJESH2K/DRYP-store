
import { useState, useEffect, useCallback } from 'react';
import type { Item } from '../types';
import { apiCall } from '../lib/api';
import { mapProductsToItems } from '../utils/productMapping';

export function useHomeScreenData() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const [brandsData, categoriesData, colorsData] = await Promise.all([
        apiCall('/api/products/brands'),
        apiCall('/api/products/categories'),
        apiCall('/api/products/colors'),
      ]);
      if (Array.isArray(brandsData)) setBrands(brandsData);
      if (Array.isArray(categoriesData)) setCategories(categoriesData);
      if (Array.isArray(colorsData)) setColors(colorsData);
    } catch (error) {
      console.warn('Failed to load filter options', error);
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBrands.length > 0) params.append('brand', selectedBrands.join(','));
      if (selectedCategories.length > 0) params.append('category', selectedCategories.join(','));
      if (selectedColors.length > 0) params.append('color', selectedColors.join(','));
      
      const products = await apiCall(`/api/products?${params.toString()}`);
      setItems(Array.isArray(products) ? mapProductsToItems(products) : []);
    } catch (error) {
      console.warn('Failed to load products', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBrands, selectedCategories, selectedColors]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);
  
  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const clearFilters = () => {
    setSelectedBrands([]);
    setSelectedCategories([]);
    setSelectedColors([]);
  };

  return {
    items,
    setItems,
    loading,
    filters: {
      brands,
      categories,
      colors,
    },
    selectedFilters: {
      selectedBrands,
      selectedCategories,
      selectedColors,
    },
    setSelectedFilters: {
      setSelectedBrands,
      setSelectedCategories,
      setSelectedColors,
    },
    clearFilters,
    reload: loadRecommendations,
  };
}
