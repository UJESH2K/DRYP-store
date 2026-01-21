import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';
import { useAuthStore } from '../../src/state/auth';
import { apiCall } from '../../src/lib/api';
import AnimatedLoadingScreen from '../../src/components/common/AnimatedLoadingScreen';

// Helper function to sort options, putting selected items first
const sortWithOptions = (options: string[], selectedOptions: string[]) => {
  if (!options) return [];
  const selectedSet = new Set(selectedOptions);
  return [...options].sort((a, b) => {
    const aIsSelected = selectedSet.has(a);
    const bIsSelected = selectedSet.has(b);
    if (aIsSelected && !bIsSelected) return -1;
    if (!aIsSelected && bIsSelected) return 1;
    return a.localeCompare(b); // Alphabetical sort for the rest
  });
};

export default function StyleScreen() {
  const router = useCustomRouter();
  const { user, updateUser } = useAuthStore();

  const [selectedStyles, setSelectedStyles] = useState(user?.preferences?.categories || []);
  const [selectedColors, setSelectedColors] = useState(user?.preferences?.colors || []);
  const [selectedBrands, setSelectedBrands] = useState(user?.preferences?.brands || []);
  
  const [styleOptions, setStyleOptions] = useState([]);
  const [colorOptions, setColorOptions] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [tags, colors, brands] = await Promise.all([
          apiCall('/api/products/tags'),
          apiCall('/api/products/colors'),
          apiCall('/api/products/brands'),
        ]);

        // Sort the fetched options based on current user preferences
        if (Array.isArray(tags)) setStyleOptions(sortWithOptions(tags, user?.preferences?.categories || []));
        if (Array.isArray(colors)) setColorOptions(sortWithOptions(colors, user?.preferences?.colors || []));
        if (Array.isArray(brands)) setBrandOptions(sortWithOptions(brands, user?.preferences?.brands || []));

      } catch (error) {
        console.error("Failed to fetch style options:", error);
        Alert.alert("Error", "Could not load style options. Please try again later.");
      } finally {
        setIsLoadingOptions(false);
      }
    };
    fetchOptions();
  }, []); // Fetch only on component mount

  const toggleSelection = (array: string[], setArray: (arr: string[]) => void, item: string) => {
    setArray(array.includes(item) ? array.filter(i => i !== item) : [...array, item]);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const preferences = {
        categories: selectedStyles,
        colors: selectedColors,
        brands: selectedBrands,
      };

      const updatedUser = await apiCall('/api/users/preferences', {
        method: 'PUT',
        body: JSON.stringify(preferences),
      });

      if (updatedUser) {
        await updateUser(updatedUser);
        
        // Re-sort the lists to bring new selections to the front
        setStyleOptions(sortWithOptions(styleOptions, selectedStyles));
        setColorOptions(sortWithOptions(colorOptions, selectedColors));
        setBrandOptions(sortWithOptions(brandOptions, selectedBrands));
        
        Alert.alert('Success', 'Your preferences have been saved!');
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Could not save your preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingOptions) {
    return <AnimatedLoadingScreen text="Loading style options..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Help us personalize your shopping experience.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Styles</Text>
          <View style={styles.brandGrid}>
            {styleOptions.map((style) => (
              <Pressable
                key={style}
                style={[styles.brandOption, selectedStyles.includes(style) && styles.selectedBrand]}
                onPress={() => toggleSelection(selectedStyles, setSelectedStyles, style)}
              >
                <Text style={[styles.brandText, selectedStyles.includes(style) && styles.selectedBrandText]}>
                  {style}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Colors</Text>
          <View style={styles.brandGrid}>
            {colorOptions.map((color) => (
              <Pressable
                key={color}
                style={[styles.brandOption, selectedColors.includes(color) && styles.selectedBrand]}
                onPress={() => toggleSelection(selectedColors, setSelectedColors, color)}
              >
                <Text style={[styles.brandText, selectedColors.includes(color) && styles.selectedBrandText]}>
                  {color}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Brands</Text>
          <View style={styles.brandGrid}>
            {brandOptions.map((brand) => (
              <Pressable
                key={brand}
                style={[styles.brandOption, selectedBrands.includes(brand) && styles.selectedBrand]}
                onPress={() => toggleSelection(selectedBrands, setSelectedBrands, brand)}
              >
                <Text style={[styles.brandText, selectedBrands.includes(brand) && styles.selectedBrandText]}>
                  {brand}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        
        <View style={styles.bottomSpacing} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.saveButton, isSaving && styles.disabledButton]} onPress={handleSave} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    description: {
        fontSize: 16,
        color: '#6c757d',
        textAlign: 'center',
        lineHeight: 24,
        marginTop: 16,
        marginBottom: 24,
        fontFamily: 'Zaloga',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontFamily: 'Zaloga',
        color: '#343a40',
        marginBottom: 16,
    },
    brandGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    brandOption: {
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    selectedBrand: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    brandText: {
        fontSize: 16,
        color: '#343a40',
        fontFamily: 'Zaloga',
    },
    selectedBrandText: {
        color: '#fff',
    },
    footer: {
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
    },
    saveButton: {
        backgroundColor: '#000',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'Zaloga',
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    bottomSpacing: {
        height: 100,
    },
});