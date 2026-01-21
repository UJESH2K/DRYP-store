const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.9:5000';

/**
 * Derives a price tier ('low', 'mid', 'high') from a product's price.
 * @param {number} price The product price.
 * @returns {'low' | 'mid' | 'high'}
 */
const getPriceTier = (price) => {
  if (price < 50) return 'low';
  if (price < 150) return 'mid';
  return 'high';
};

/**
 * Extracts all unique sizes and colors from a product's variants and options.
 * @param {object} product The raw product object from the backend.
 * @returns {{ sizes: string[], colors: string[] }}
 */
const getSizesAndColors = (product) => {
  const sizes = new Set();
  const colors = new Set();

  if (product.options && product.options.length > 0) {
    const sizeOption = product.options.find(opt => opt.name.toLowerCase() === 'size');
    if (sizeOption) {
      sizeOption.values.forEach(v => sizes.add(v));
    }
    
    const colorOption = product.options.find(opt => opt.name.toLowerCase() === 'color');
    if (colorOption) {
      colorOption.values.forEach(v => colors.add(v));
    }
  }

  return {
    sizes: Array.from(sizes),
    colors: Array.from(colors),
  };
};

/**
 * Maps a raw product object from the backend API to the frontend Item type.
 * @param {object} product The raw product object from the backend.
 * @returns {import('../types').Item}
 */
export const mapProductToItem = (product) => {
  if (!product) return null;

  const { sizes, colors } = getSizesAndColors(product);

  return {
    id: product._id,
    title: product.name,
    subtitle: product.description.substring(0, 50) + '...', // Create a subtitle
    image: product.images && product.images.length > 0 
      ? `${API_BASE_URL}${product.images[0]}`
      : 'https://via.placeholder.com/800x1200', // Placeholder
    tags: product.tags || [],
    category: product.category,
    priceTier: getPriceTier(product.basePrice),
    brand: product.brand,
    price: product.basePrice,
    description: product.description,
    sizes,
    colors,
  };
};

/**
 * Maps an array of backend products to an array of frontend items.
 * @param {object[]} products - The array of product objects from the backend.
 * @returns {import('../data/items').Item[]}
 */
export const mapProductsToItems = (products) => {
  if (!Array.isArray(products)) return [];
  return products.map(mapProductToItem).filter(Boolean); // Filter out any nulls
};