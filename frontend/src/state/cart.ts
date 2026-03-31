import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiCall } from '../lib/api';

export type CartItem = {
  id: string; // This will be a composite key: `${productId}-${variantId}`
  productId: string;
  title: string;
  price: number;
  image: string;
  brand: string;
  quantity: number;
  options?: { [key: string]: string };
};

type CartState = {
  items: CartItem[];
  fetchCart: () => Promise<void>;
  addToCart: (item: Omit<CartItem, 'id'> & { id?: string }) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateCartItem: (oldId: string, newItemData: Omit<CartItem, 'id' | 'quantity'>) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
};

// Function to generate a unique ID for a cart item based on product and options
const generateCartId = (productId: string, options?: { [key: string]: string }) => {
  if (!options || Object.keys(options).length === 0) {
    return productId;
  }
  const sortedOptions = Object.keys(options).sort().map(key => `${key}-${options[key]}`).join('_');
  return `${productId}_${sortedOptions}`;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      
      fetchCart: async () => {
        try {
          const data = await apiCall('/api/cart');
          if (Array.isArray(data)) {
            // Deduplicate items just in case the backend sends corrupted duplicate data
            const syncedItems = data.reduce((acc: CartItem[], item: any) => {
              // Use optional chaining (?.) to prevent crashes if product is null/undefined
              const id = generateCartId(item.product?._id || item.product, item.options);
              const existingItem = acc.find(i => i.id === id);
              
              if (existingItem) {
                existingItem.quantity += item.quantity;
              } else {
                acc.push({
                  id,
                  productId: item.product?._id || item.product,
                  // Look for .name first, then .title, then fallback
                  title: item.product?.name || item.product?.title || 'Unknown Product',
                  price: item.price,
                  image: item.product?.images?.[0] || '',
                  brand: item.product?.brand || 'Unknown Brand',
                  quantity: item.quantity,
                  options: item.options
                });
              }
              return acc;
            }, []);
            set({ items: syncedItems });
          }
        } catch (error) {
          console.error("Failed to sync cart from server:", error);
        }
      },

      addToCart: async (item) => {
        if (typeof item.price !== 'number' || isNaN(item.price)) {
          console.error("Invalid price in addToCart. Aborting action.");
          return;
        }

        const cartId = item.id || generateCartId(item.productId, item.options);
        const existingItem = get().items.find(i => i.id === cartId);

        // Update local state immediately for a snappy UI
        if (existingItem) {
          set((state) => ({
            items: state.items.map(i =>
              i.id === cartId
                ? { ...i, quantity: i.quantity + (item.quantity || 1) }
                : i
            ),
          }));
        } else {
          const newItem: CartItem = {
            ...item,
            id: cartId,
            quantity: item.quantity || 1,
          };
          set((state) => ({ items: [...state.items, newItem] }));
        }

        // Push changes to the backend
        try {
          await apiCall('/api/cart', {
            method: 'POST',
            body: JSON.stringify({
              productId: item.productId,
              quantity: item.quantity || 1,
              price: item.price,
              options: item.options
            })
          });
        } catch (error) {
          console.error("Failed to push cart item to server:", error);
        }
      },
      
      removeFromCart: async (id) => {
        const itemToRemove = get().items.find(i => i.id === id);

        // Update local state immediately
        set((state) => ({
          items: state.items.filter(item => item.id !== id)
        }));

        // Delete from the backend (URL Encoded!)
        if (itemToRemove) {
          try {
            await apiCall(`/api/cart/${encodeURIComponent(itemToRemove.id)}`, { method: 'DELETE' });
          } catch (error) {
            console.error("Failed to delete cart item on server:", error);
          }
        }
      },
      
      updateQuantity: async (id, quantity) => {
        const itemToUpdate = get().items.find(i => i.id === id);

        // Update local state immediately
        set((state) => ({
          items: state.items.map(item =>
            item.id === id ? { ...item, quantity: Math.max(0, quantity) } : item
          ).filter(item => item.quantity > 0), // Remove if quantity is 0
        }));

        // Update on the backend (URL Encoded!)
        if (itemToUpdate) {
          try {
            if (quantity <= 0) {
              await apiCall(`/api/cart/${encodeURIComponent(itemToUpdate.id)}`, { method: 'DELETE' });
            } else {
              await apiCall(`/api/cart/${encodeURIComponent(itemToUpdate.id)}`, {
                method: 'PUT',
                body: JSON.stringify({ quantity })
              });
            }
          } catch (error) {
            console.error("Failed to update cart quantity on server:", error);
          }
        }
      },
      
      updateCartItem: (oldId, newItemData) => {
        if (typeof newItemData.price !== 'number' || isNaN(newItemData.price)) {
          console.error("Invalid price in updateCartItem. Aborting update.");
          return;
        }
        
        const newId = generateCartId(newItemData.productId, newItemData.options);
        const existingItem = get().items.find(i => i.id === oldId);

        if (!existingItem) return;

        const newCartItem: CartItem = {
          ...newItemData,
          id: newId,
          quantity: existingItem.quantity, // Keep the quantity
        };

        set(state => ({
          items: state.items.map(item =>
            item.id === oldId ? newCartItem : item
          ),
        }));

        // Optional: Implement backend sync here if necessary. 
        // Typically involves a DELETE of the old variant and POST of the new variant.
      },

      clearCart: () => set({ items: [] }),
      
      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
      },
      
      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },
    }),
    {
      name: 'cart-storage', // unique name
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);