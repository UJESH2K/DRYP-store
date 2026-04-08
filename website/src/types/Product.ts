export interface Variant {
  price: number;
  stock: number; // It's a flat number coming from the API!
  images: string[];
  options?: {
    Color?: string;
    Size?: string;
    [key: string]: any;
  };
  color?: string; 
  sizes?: string; 
}

export interface Product {
  _id?: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  tags: string[];
  basePrice: number;
  variants: Variant[];
  images?: string[];
}
