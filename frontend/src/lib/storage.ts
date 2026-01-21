
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT_SEARCHES = 10;

export const getRecentSearches = async (): Promise<string[]> => {
  try {
    const searchesJson = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    return searchesJson ? JSON.parse(searchesJson) : [];
  } catch (e) {
    console.error('Failed to load recent searches.', e);
    return [];
  }
};

export const addRecentSearch = async (searchQuery: string): Promise<void> => {
  if (!searchQuery?.trim()) return;

  try {
    const currentSearches = await getRecentSearches();
    
    // Remove the query if it already exists to move it to the front
    const filteredSearches = currentSearches.filter(s => s.toLowerCase() !== searchQuery.toLowerCase());
    
    // Add the new query to the beginning of the array
    const newSearches = [searchQuery, ...filteredSearches];
    
    // Trim the array to the maximum length
    if (newSearches.length > MAX_RECENT_SEARCHES) {
      newSearches.length = MAX_RECENT_SEARCHES;
    }
    
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(newSearches));
  } catch (e) {
    console.error('Failed to save recent search.', e);
  }
};
