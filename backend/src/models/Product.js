const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Color", "Size"
  values: { type: [String], required: true }, // e.g., ["Red", "Blue"], ["S", "M", "L"]
}, { _id: false });

const VariantSchema = new mongoose.Schema({
  options: { type: Map, of: String, required: true }, // e.g., { "Color": "Red", "Size": "M" }
  sku: { type: String, required: false, unique: true, sparse: true }, // Stock Keeping Unit
  stock: { type: Number, required: true, min: 0, default: 0 },
  price: { type: Number, required: true }, // Optional: if different from base price
  images: { type: [String], default: [] }, // Optional: if variant has its own images
}, { _id: false });

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: false },
  
  // Core Details
  brand: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  tags: { type: [String], default: [], index: true },
  
  // Pricing & Stock
  basePrice: { type: Number, required: true, min: 0 },
  sku: { type: String, required: false, unique: true, sparse: true }, // For simple products
  stock: { type: Number, default: 0 }, // For simple products without variants
  
  // Variants for complex products
  options: { type: [OptionSchema], default: [] },
  variants: { type: [VariantSchema], default: [] },
  
  // Media
  images: { type: [String], default: [] },

  // Ownership & Status
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Changed ref to 'User'
  isActive: { type: Boolean, default: true },

  // Social
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
}, { timestamps: true });

// Ensure that for a given product, each variant has a unique combination of options
ProductSchema.path('variants').validate(function(variants) {
  if (variants.length === 0) return true;

  const uniqueVariants = new Set();
  for (const variant of variants) {
    const key = Object.entries(variant.options).sort().toString();
    if (uniqueVariants.has(key)) {
      return false; // Duplicate variant found
    }
    uniqueVariants.add(key);
  }
  return true;
}, 'Product variants must have unique option combinations.');


module.exports = mongoose.model('Product', ProductSchema);