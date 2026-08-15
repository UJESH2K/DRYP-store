import { useState, useEffect, useCallback, useRef } from 'react';
import type { Item } from '../types';
import { apiCall } from '../lib/api';
import { mapProductsToItems } from '../utils/productMapping';
import { rankItems } from '../lib/recommender';

const FEED_PAGE_SIZE = 50;
// Node rejects request lines + headers over 16KB, so the exclude param must be
// windowed: ~24-char ObjectIds + commas means ~500 ids is the largest list that
// reliably fits. Any older items the server re-serves are dropped client-side.
const MAX_EXCLUDE_IDS = 500;
// When the exclude window truncates, the server can return a batch made up
// entirely of already-seen items. Retry with the dupes added to the exclude
// set so paging still reaches the true end of the catalog.
const MAX_LOAD_MORE_ATTEMPTS = 3;

export function useHomeScreenData() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // True only once the server has no unseen items left — gates the
  // "All caught up" message so it never shows on mere deck exhaustion.
  const [endReached, setEndReached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);

  // Latest-value refs so loadMore never acts on a stale closure.
  const itemsRef = useRef<Item[]>([]);
  const filtersRef = useRef({
    selectedBrands: [] as string[],
    selectedCategories: [] as string[],
    selectedColors: [] as string[],
  });
  // Bumped on every full reload. In-flight responses from an older epoch
  // (e.g. a loadMore racing a filter change) are discarded.
  const epochRef = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => {
    filtersRef.current = { selectedBrands, selectedCategories, selectedColors };
  }, [selectedBrands, selectedCategories, selectedColors]);

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
    } catch (err) {
      if (__DEV__) { console.warn('Failed to load filter options', err); }
    }
  }, []);

  // Both the unfiltered and the filtered deck hit the personalized feed —
  // feed.js accepts the same brand/category/color params as /api/products.
  const buildFeedParams = useCallback((excludeIds: string[] = []) => {
    const params = new URLSearchParams();
    const current = filtersRef.current;
    current.selectedBrands.forEach(brand => params.append('brand', brand));
    current.selectedCategories.forEach(category => params.append('category', category));
    current.selectedColors.forEach(color => params.append('color', color));
    params.set('limit', String(FEED_PAGE_SIZE));
    if (excludeIds.length > 0) {
      params.set('exclude', excludeIds.slice(-MAX_EXCLUDE_IDS).join(','));
    }
    return params;
  }, []);

  const loadRecommendations = useCallback(async () => {
    const epoch = ++epochRef.current;
    // No setLoading(true) here on purpose: the boot loader must only show on
    // the very first mount. Triggering it later unmounts dropdowns mid-click.
    try {
      const params = buildFeedParams();
      const products = await apiCall(`/api/feed/personalized?${params.toString()}`);
      if (epoch !== epochRef.current) return; // a newer reload won the race

      // Deduplicate products coming from the API based on their ID
      if (Array.isArray(products)) {
        const mappedItems = mapProductsToItems(products);
        const uniqueItems = mappedItems.filter((item, index, self) =>
          index === self.findIndex((t) => t.id === item.id)
        );
        setItems(rankItems(uniqueItems));
        setEndReached(products.length < FEED_PAGE_SIZE);
        setError(null);
      } else {
        // apiCall returns the error body on non-2xx (it never throws), so a
        // non-array here is a failed request — not an empty catalog.
        setItems([]);
        setEndReached(false);
        setError('Unable to load products. Check your connection.');
      }
    } catch (err) {
      if (epoch !== epochRef.current) return;
      if (__DEV__) { console.error('Failed to load feed:', err); }
      setItems([]);
      setEndReached(true);
      setError('Unable to load products. Check your connection.');
    } finally {
      if (epoch === epochRef.current) setLoading(false);
    }
  }, [buildFeedParams]);

  // Pages the personalized feed. Returns the number of NEW items appended;
  // 0 means the catalog (or the active filter slice) is exhausted.
  const loadMore = useCallback(async (): Promise<number> => {
    if (loadingMoreRef.current) return 0;
    const epoch = epochRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const seen = new Set(itemsRef.current.map(item => item.id));
      const excludeIds = Array.from(seen);
      let appended: Item[] = [];
      let rawCount = 1;
      let attempts = 0;

      while (appended.length === 0 && rawCount > 0 && attempts < MAX_LOAD_MORE_ATTEMPTS) {
        attempts += 1;
        const params = buildFeedParams(excludeIds);
        const products = await apiCall(`/api/feed/personalized?${params.toString()}`);
        if (epoch !== epochRef.current) return 0; // reload/filter changed mid-flight

        // apiCall returns the error body on non-2xx — don't treat a failed
        // request as reaching the end of the catalog.
        if (!Array.isArray(products)) {
          if (appended.length === 0) {
            setError('Unable to load more products. Check your connection.');
          }
          return appended.length;
        }

        const raw = products;
        rawCount = raw.length;
        // Track re-served dupes too so the next attempt's exclude window advances.
        raw.forEach((p: any) => { if (p && p._id) excludeIds.push(String(p._id)); });

        const fresh = mapProductsToItems(raw).filter(item => !seen.has(item.id));
        if (fresh.length > 0) {
          fresh.forEach(item => seen.add(item.id));
          // Rank ONLY this batch and append — reshuffling the whole list here
          // would reorder the deck underneath the card being swiped.
          setItems(prev => [...prev, ...rankItems(fresh)]);
          appended = fresh;
        }
      }

      if (epoch !== epochRef.current) return 0;
      if (appended.length === 0) setEndReached(true);
      return appended.length;
    } catch (err) {
      if (__DEV__) { console.warn('Failed to load more feed items', err); }
      return 0;
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [buildFeedParams]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);
  
  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // Refetch the deck when the user changes brand/category/color filters.
  // Skipped on mount: loadRecommendations() above already runs the boot load.
  // The epoch guard inside loadRecommendations discards in-flight responses
  // from the previous filter state, so a loadMore racing a filter change
  // cannot leak stale items into the new deck.
  const appliedFiltersRef = useRef<string | null>(null);
  useEffect(() => {
    const key = JSON.stringify([selectedBrands, selectedCategories, selectedColors]);
    if (appliedFiltersRef.current === null) {
      appliedFiltersRef.current = key; // mount — boot load covers it
      return;
    }
    if (appliedFiltersRef.current !== key) {
      appliedFiltersRef.current = key;
      loadRecommendations();
    }
  }, [selectedBrands, selectedCategories, selectedColors, loadRecommendations]);

  const clearFilters = () => {
    setSelectedBrands([]);
    setSelectedCategories([]);
    setSelectedColors([]);
  };

  return {
    items,
    setItems,
    loading,
    loadingMore,
    endReached,
    error,
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
    loadMore,
  };
}
