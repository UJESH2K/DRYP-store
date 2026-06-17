/**
 * Shared types for the website (Next.js).
 *
 * These mirror the Mongoose models in backend/src/models/ and the
 * `User` type in frontend/src/state/auth.ts. They are intentionally
 * declared in triplicate for now: full deduplication would require a
 * shared package, which is P5.5. Keep them in sync.
 *
 * Conventions:
 *   - Optional server fields use `?` so UI code must handle them.
 *   - Image URLs are always relative (`/uploads/...`) when served
 *     from the backend; pass them through `getImageUrl()` to get an
 *     absolute URL.
 */

export type Role = 'user' | 'vendor' | 'admin';

export interface UserPreferences {
  currency: string;
  categories: string[];
  colors: string[];
  brands: string[];
}

export interface User {
  _id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  preferences: UserPreferences;
}

export interface VendorAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Vendor {
  _id: string;
  owner: string; // User._id
  name: string;
  email: string;
  description?: string;
  logo?: string;
  address?: VendorAddress;
  phone?: string;
  website?: string;
  isActive: boolean;
}

export interface ProductVariant {
  options: Record<string, string>; // e.g. { Color: 'Red', Size: 'M' }
  sku?: string;
  stock: number;
  price: number;
  images?: string[];
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  brand: string;
  category: string;
  tags: string[];
  basePrice: number;
  sku?: string;
  stock: number;
  options: { name: string; values: string[] }[];
  variants: ProductVariant[];
  images: string[];
  vendor: string; // User._id
  isActive: boolean;
  rating: number;
  reviews: number;
  likes: number;
  createdAt: string;
  updatedAt: string;
}
