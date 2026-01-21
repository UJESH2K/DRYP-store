export interface Variant {
  color: string;
  sizes: string;
  price: number;
  stock: { [key: string]: number };
  images: string[];
  options?: {
    Color?: string;
    Size?: string;
  };
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
