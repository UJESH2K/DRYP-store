import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCustomRouter } from '../src/hooks/useCustomRouter';
import { useAuthStore } from '../src/state/auth';
import { useSettingsStore } from '../src/state/settings';
import { useCacheStore } from '../src/state/cache';
import { apiCall } from '../src/lib/api';
import SingleSelectDropdown from '../src/components/SingleSelectDropdown';
import StepIndicator from '../src/components/onboarding/StepIndicator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const countryCurrencyOptions = [
  { label: '🇮🇳 India (INR)', value: 'INR' },
  { label: '🇺🇸 United States (USD)', value: 'USD' },
  { label: '🇪🇺 Europe (EUR)', value: 'EUR' },
  { label: '🇬🇧 United Kingdom (GBP)', value: 'GBP' },
];

const steps = ['currency', 'categories', 'colors', 'brands'];

export default function Onboarding() {
  const router = useCustomRouter();
  const { user, updateUser } = useAuthStore();
  const { currency, setCurrency } = useSettingsStore();
  const { categories: cachedCategories, brands: cachedBrands, setCategories: setCachedCategories, setBrands: setCachedBrands } = useCacheStore();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const [categories, setCategories] = useState<string[]>(cachedCategories.data || []);
  const [brands, setBrands] = useState<string[]>(cachedBrands.data || []);
  const [colors, setColors] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(user?.preferences?.categories || []);
  const [selectedColors, setSelectedColors] = useState<string[]>(user?.preferences?.colors || []);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(user?.preferences?.brands || []);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const welcomeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchPreferenceData = async () => {
      setIsFetching(true);
      try {
        const now = Date.now();
        const categoriesPromise = apiCall('/api/products/tags'); // Using tags for styles
        const brandsPromise = apiCall('/api/products/brands');
        const colorsPromise = apiCall('/api/products/colors');

        const [categoriesData, brandsData, colorsData] = await Promise.all([categoriesPromise, brandsPromise, colorsPromise]);

        if (Array.isArray(categoriesData)) setCategories(categoriesData);
        if (Array.isArray(brandsData)) setBrands(brandsData);
        if (Array.isArray(colorsData)) setColors(colorsData);

      } catch (error) {
        Alert.alert('Error', 'Could not load preference options.');
      } finally {
        setIsFetching(false);
      }
    };
    fetchPreferenceData();
  }, []);
  
  useEffect(() => {
    if (showWelcome) {
      Animated.timing(welcomeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        router.replace('/(tabs)/home');
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  const toggleSelection = (array: string[], setArray: (arr: string[]) => void, item: string) => {
    setArray(array.includes(item) ? array.filter(i => i !== item) : [...array, item]);
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const finishOnboarding = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      const preferences = {
        currency: selectedCurrency,
        categories: selectedCategories,
        colors: selectedColors,
        brands: selectedBrands,
      };

      const updatedUser = await apiCall('/api/users/preferences', {
        method: 'PUT',
        body: JSON.stringify(preferences),
      });

      if (updatedUser) {
        await updateUser(updatedUser);
        setCurrency(selectedCurrency);
        setShowWelcome(true);
      } else {
        throw new Error('Failed to save preferences');
      }
      
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Could not save your preferences. Please try again.', [{ text: 'OK' }]);
    } finally {
      setIsSaving(false);
    }
  };
  
  const renderStepContent = () => {
    const step = steps[currentStepIndex];

    if (isFetching && step !== 'currency') {
      return <ActivityIndicator size="large" style={styles.centered} />;
    }
    
    switch (step) {
      case 'currency':
        return (
          <View style={styles.contentContainer}>
            <SingleSelectDropdown
              options={countryCurrencyOptions}
              selectedValue={selectedCurrency}
              onSelectionChange={setSelectedCurrency}
              placeholder="Select your currency"
            />
          </View>
        );
      case 'categories':
        return (
          <FlatList
            data={categories}
            keyExtractor={(item) => item}
            numColumns={2}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.optionCard, selectedCategories.includes(item) && styles.selectedCard]}
                onPress={() => toggleSelection(selectedCategories, setSelectedCategories, item)}
              >
                <Text style={[styles.optionText, selectedCategories.includes(item) && styles.selectedText]}>{item}</Text>
              </Pressable>
            )}
          />
        );
      case 'colors':
        return (
            <FlatList
              data={colors}
              keyExtractor={(item) => item}
              numColumns={2}
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.optionCard, selectedColors.includes(item) && styles.selectedCard]}
                  onPress={() => toggleSelection(selectedColors, setSelectedColors, item)}
                >
                  <Text style={[styles.optionText, selectedColors.includes(item) && styles.selectedText]}>{item}</Text>
                </Pressable>
              )}
            />
        );
      case 'brands':
        return (
            <FlatList
              data={brands}
              keyExtractor={(item) => item}
              numColumns={2}
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.optionCard, selectedBrands.includes(item) && styles.selectedCard]}
                  onPress={() => toggleSelection(selectedBrands, setSelectedBrands, item)}
                >
                  <Text style={[styles.optionText, selectedBrands.includes(item) && styles.selectedText]}>{item}</Text>
                </Pressable>
              )}
            />
        );
      default: return null;
    }
  };

  if (showWelcome) {
    const scale = welcomeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
    const opacity = welcomeAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] });
    return (
      <View style={styles.welcomeContainer}>
        <Animated.Text style={[styles.welcomeLogo, { transform: [{ scale }], opacity }]}>DRYP</Animated.Text>
        <Animated.Text style={[styles.welcomeText, { opacity }]}>Welcome!</Animated.Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <StepIndicator totalSteps={steps.length} currentStep={currentStepIndex} />
      <View style={styles.header}>
        <Text style={styles.title}>
          {currentStepIndex === 0 ? 'Select Your Currency' :
           currentStepIndex === 1 ? 'Choose Your Styles' :
           currentStepIndex === 2 ? 'Select Favorite Colors' :
           'Pick Preferred Brands'}
        </Text>
        <Text style={styles.subtitle}>Help us personalize your experience.</Text>
      </View>
      <View style={styles.contentBody}>
        {renderStepContent()}
      </View>
      <View style={styles.footer}>
        {currentStepIndex > 0 && (
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.nextButton, (isSaving || (isFetching && currentStepIndex > 0)) && styles.disabledButton]}
          onPress={currentStepIndex === steps.length - 1 ? finishOnboarding : handleNext}
          disabled={isSaving || (isFetching && currentStepIndex > 0)}
        >
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.nextButtonText}>
              {currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 24, alignItems: 'center' },
  title: { fontSize: 28, color: '#1a1a1a', marginBottom: 8, fontFamily: 'Zaloga' },
  subtitle: { fontSize: 16, color: '#6c757d', fontFamily: 'Zaloga' },
  contentBody: { flex: 1 },
  contentContainer: { paddingHorizontal: 24, paddingTop: 40 },
  grid: { paddingHorizontal: 16 },
  optionCard: {
    flex: 1,
    margin: 8,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  selectedCard: { backgroundColor: '#1a1a1a', borderColor: '#000' },
  optionText: { fontSize: 16, color: '#1a1a1a', textAlign: 'center', fontFamily: 'Zaloga' },
  selectedText: { color: '#ffffff' },
  footer: { flexDirection: 'row', padding: 24, borderTopWidth: 1, borderTopColor: '#e9ecef' },
  backButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', marginRight: 8, backgroundColor: '#f0f0f0' },
  backButtonText: { fontSize: 16, color: '#1a1a1a', fontFamily: 'Zaloga' },
  nextButton: { flex: 2, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#1a1a1a' },
  nextButtonText: { fontSize: 16, color: '#ffffff', fontFamily: 'Zaloga' },
  disabledButton: { backgroundColor: '#ccc' },
  welcomeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  welcomeLogo: { fontSize: 60, color: '#fff', fontFamily: 'Zaloga' },
  welcomeText: { fontSize: 24, color: '#fff', fontFamily: 'Zaloga', marginTop: 10 },
});