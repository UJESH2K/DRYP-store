import { useSettingsStore } from '../state/settings';

export const formatPrice = (price: number) => {
  const { currency } = useSettingsStore.getState();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
  } catch (e) {
    // Fallback for invalid currency code
    return `${currency} ${(price || 0).toFixed(2)}`;
  }
};
