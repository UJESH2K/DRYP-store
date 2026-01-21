// This file will serve as the single source of truth for shared type definitions.

export type Item = {
  id: string
  title: string
  subtitle?: string
  image: string
  tags: string[]
  category: string
  priceTier: 'low' | 'mid' | 'high'
  brand: string
  price: number
  description: string
  sizes: string[]
  colors: string[]
}

export interface ProductVariant {
  _id: string;
  options: { [key: string]: string };
  price: number;
  stock: number;
  images?: string[];
}

export interface ProductOption {
  name: string;
  values: string[];
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  images: string[];
  basePrice: number;
  stock: number;
  options?: ProductOption[];
  variants?: ProductVariant[];
  tags?: string[];
  isActive: boolean;
  vendor: {
    _id: string;
    name: string;
  };
  rating: number;
  reviews: number;
  likes: number;
  sku?: string;
  createdAt: string;
  updatedAt: string;
}