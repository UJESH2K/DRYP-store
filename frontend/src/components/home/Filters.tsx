
import React from 'react';
import { View, StyleSheet } from 'react-native';
import MultiSelectDropdown from '../MultiSelectDropdown';
import { Ionicons } from '@expo/vector-icons'; // Import Ionicons

interface FiltersProps {
  filters: {
    brands: string[];
    categories: string[];
    colors: string[];
  };
  selectedFilters: {
    selectedBrands: string[];
    selectedCategories: string[];
    selectedColors: string[];
  };
  onSelectionChange: {
    setSelectedBrands: (brands: string[]) => void;
    setSelectedCategories: (categories: string[]) => void;
    setSelectedColors: (colors: string[]) => void;
  };
}

export function Filters({ filters, selectedFilters, onSelectionChange }: FiltersProps) {
  return (
    <View style={styles.filtersContainer}>
      <Ionicons name="filter-outline" size={24} color="#000" style={styles.filterIcon} />
      <MultiSelectDropdown
        options={filters.brands}
        selectedOptions={selectedFilters.selectedBrands}
        onSelectionChange={onSelectionChange.setSelectedBrands}
        placeholder="Brands"
      />
      <MultiSelectDropdown
        options={filters.categories}
        selectedOptions={selectedFilters.selectedCategories}
        onSelectionChange={onSelectionChange.setSelectedCategories}
        placeholder="Categories"
      />
      <MultiSelectDropdown
        options={filters.colors}
        selectedOptions={selectedFilters.selectedColors}
        onSelectionChange={onSelectionChange.setSelectedColors}
        placeholder="Colors"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filtersContainer: {
    flexDirection: 'row',
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center', // Align items vertically
    gap: 10,
  },
  filterIcon: {
    marginRight: 5, // Space between icon and dropdown
  },
});
