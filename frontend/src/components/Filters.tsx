import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  Pressable, 
  ScrollView, 
  Dimensions,
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EdgeInsets } from 'react-native-safe-area-context';

interface FiltersProps {
  headerHeight: number;
  insets: EdgeInsets;
  closeFilters: () => void;
  minPrice: string;
  setMinPrice: (value: string) => void;
  maxPrice: string;
  setMaxPrice: (value: string) => void;
  categories: string[];
  selectedCategory: string | null;
  setSelectedCategory: (value: string | null) => void;
  brands: string[];
  selectedBrand: string | null;
  setSelectedBrand: (value: string | null) => void;
  colors: string[];
  selectedColor: string | null;
  setSelectedColor: (value: string | null) => void;
  clearFilters: () => void;
  applyFilters: () => void;
}

const Filters: React.FC<FiltersProps> = ({
  headerHeight,
  insets,
  closeFilters,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  categories,
  selectedCategory,
  setSelectedCategory,
  brands,
  selectedBrand,
  setSelectedBrand,
  colors,
  selectedColor,
  setSelectedColor,
  clearFilters,
  applyFilters,
}) => {
  const windowHeight = Dimensions.get('window').height;
  const [activeTab, setActiveTab] = useState('Price');
  
  // Reduced modal height to 65% and added bottom safe area consideration
  const modalHeight = windowHeight * 0.65;
  
  // Adjusted bottom padding with extra space
  const bottomPadding = Platform.select({
    ios: insets.bottom > 0 ? insets.bottom + 20 : 30,
    android: 30,
    default: 30
  });

  const tabs = ['Price', 'Categories', 'Brands', 'Colors'];

  return (
    <>
      {/* Overlay background */}
      <Pressable 
        style={styles.overlay}
        onPress={closeFilters}
      />
      
      {/* Filters modal */}
      <View 
        style={[
          styles.container, 
          { 
            top: windowHeight - modalHeight, // Position from bottom
            height: modalHeight,
          }
        ]}
      >
        {/* Drag handle */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>
        
        <Pressable style={styles.closeButton} onPress={closeFilters}>
          <Ionicons name="close" size={24} color="#888" />
        </Pressable>
        
        <Text style={styles.sectionTitle}>Filters</Text>

        <View style={styles.tabsContainer}>
          {tabs.map(tab => (
            <Pressable 
              key={tab} 
              style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]} 
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {activeTab === 'Price' && (
            <View>
                <Text style={styles.subSectionTitle}>Price Range</Text>
                <View style={styles.priceRangeContainer}>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Min Price"
                    keyboardType="numeric"
                    value={minPrice}
                    onChangeText={setMinPrice}
                  />
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Max Price"
                    keyboardType="numeric"
                    value={maxPrice}
                    onChangeText={setMaxPrice}
                  />
                </View>
                <View style={styles.verticalFilterRow}>
                    {[
                        { label: '$0 - $50', min: '0', max: '50' },
                        { label: '$50 - $100', min: '50', max: '100' },
                        { label: '$100 - $200', min: '100', max: '200' },
                        { label: '$200+', min: '200', max: '' },
                    ].map(range => (
                        <Pressable
                            key={range.label}
                            style={[
                                styles.filterButton,
                                minPrice === range.min && maxPrice === range.max && styles.filterButtonSelected,
                            ]}
                            onPress={() => {
                                setMinPrice(range.min);
                                setMaxPrice(range.max);
                            }}
                        >
                            <Text
                                style={[
                                    styles.filterButtonText,
                                    minPrice === range.min && maxPrice === range.max && styles.filterButtonTextSelected,
                                ]}
                            >
                                {range.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>
        )}

          {activeTab === 'Categories' && (
            <View style={styles.tabContent}>
              <Text style={styles.subSectionTitle}>Category</Text>
              <View style={styles.filterRow}>
                {[...categories].sort().map((category) => (
                  <Pressable 
                    key={category} 
                    style={[
                      styles.filterButton, 
                      selectedCategory === category && styles.filterButtonSelected
                    ]} 
                    onPress={() => setSelectedCategory(selectedCategory === category ? null : category)}
                  >
                    <Text style={[
                      styles.filterButtonText, 
                      selectedCategory === category && styles.filterButtonTextSelected
                    ]}>
                      {category}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {activeTab === 'Brands' && (
            <View style={styles.tabContent}>
              <Text style={styles.subSectionTitle}>Brand</Text>
              <View style={styles.filterRow}>
                {[...brands].sort().map((brand) => (
                  <Pressable 
                    key={brand} 
                    style={[
                      styles.filterButton, 
                      selectedBrand === brand && styles.filterButtonSelected
                    ]} 
                    onPress={() => setSelectedBrand(selectedBrand === brand ? null : brand)}
                  >
                    <Text style={[
                      styles.filterButtonText, 
                      selectedBrand === brand && styles.filterButtonTextSelected
                    ]}>
                      {brand}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {activeTab === 'Colors' && (
            <View style={styles.tabContent}>
              <Text style={styles.subSectionTitle}>Color</Text>
              <View style={styles.filterRow}>
                {[...colors].sort().map((color) => (
                  <Pressable 
                    key={color} 
                    style={[
                      styles.filterButton, 
                      selectedColor === color && styles.filterButtonSelected
                    ]} 
                    onPress={() => setSelectedColor(selectedColor === color ? null : color)}
                  >
                    <Text style={[
                      styles.filterButtonText, 
                      selectedColor === color && styles.filterButtonTextSelected
                    ]}>
                      {color}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
        
        {/* Buttons container with proper bottom padding */}
        <View style={[styles.modalButtons, { paddingBottom: bottomPadding }]}>
          <Pressable style={[styles.modalButton, styles.clearButton]} onPress={clearFilters}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
          <Pressable style={[styles.modalButton, styles.applyButton]} onPress={applyFilters}>
            <Text style={styles.applyButtonText}>Apply</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9,
  },
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    flexDirection: 'column',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
    marginBottom: 10,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  tabContent: {
    marginBottom: 20,
  },
  sectionTitle: { 
    fontSize: 28, 
    color: '#000', 
    marginVertical: 15, 
    fontFamily: 'Zaloga',
    textAlign: 'center',
  },
  subSectionTitle: { 
    fontSize: 20, 
    color: '#000', 
    marginVertical: 10, 
    fontFamily: 'Zaloga' 
  },
  closeButton: { 
    position: 'absolute', 
    top: 15, 
    right: 20, 
    zIndex: 2,
    padding: 5,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
      tabButtonText: {
          color: '#888',
          fontFamily: 'Zaloga',
      },
      verticalFilterRow: {
          marginBottom: 10,
      },
      filterButton: { backgroundColor: '#f0f0f0', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, height: 40, marginBottom: 10, marginRight: 10 },  filterButtonSelected: { 
    backgroundColor: '#000' 
  },
  filterButtonText: { 
    color: '#000', 
    fontFamily: 'Zaloga',
    fontSize: 14,
  },
  filterButtonTextSelected: { 
    color: '#fff' 
  },
      priceRangeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },    priceInput: { flex: 1, height: 40, backgroundColor: '#f0f0f0', borderRadius: 10, paddingHorizontal: 15, fontSize: 16, marginRight: 2, fontFamily: 'Zaloga' },
  filterRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginBottom: 10,
  },
  modalButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    paddingTop: 10,
    backgroundColor: '#fff',
  },
  modalButton: { 
    flex: 1, 
    padding: 15, 
    borderRadius: 10, 
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  clearButton: { 
    backgroundColor: '#f0f0f0', 
    marginRight: 10 
  },
  clearButtonText: { 
    color: '#000', 
    fontFamily: 'Zaloga',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: { 
    backgroundColor: '#000' 
  },
  applyButtonText: { 
    color: '#fff', 
    fontFamily: 'Zaloga',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Filters;