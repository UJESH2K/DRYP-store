import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      
      addToCart: (item) => {
        if (typeof item.price !== 'number' || isNaN(item.price)) {
          console.error("Invalid price in addToCart. Aborting action.");
          return;
        }

        const cartId = item.id || generateCartId(item.productId, item.options);
        const existingItem = get().items.find(i => i.id === cartId);

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
      },
      
      removeFromCart: (id) => set((state) => ({
        items: state.items.filter(item => item.id !== id)
      })),
      
      updateQuantity: (id, quantity) => set((state) => ({
        items: state.items.map(item =>
          item.id === id ? { ...item, quantity: Math.max(0, quantity) } : item
        ).filter(item => item.quantity > 0), // Remove if quantity is 0
      })),
      
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
