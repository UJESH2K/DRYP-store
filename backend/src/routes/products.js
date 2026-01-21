const express = require('express');
const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');
const Like = require('../models/Like');
const Cart = require('../models/Cart');
const WishlistItem = require('../models/WishlistItem');
const { protect } = require('../middleware/auth');
const router = express.Router();

// @route   POST /api/products
// @desc    Create a new product
// @access  Private (Vendor only)
router.post('/', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden: Only vendors can create products' });
    }
    const productData = { ...req.body, vendor: req.user._id };
    const product = await Product.create(productData);
    res.status(201).json(product);
  } catch (error) {
    if (error.name === 'ValidationError') res.status(400).json({ message: error.message });
    else next(error);
  }
});

// @route   GET /api/products
// @desc    Get all active products with filtering
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const { brand, category, color, search, vendor, minPrice, maxPrice } = req.query;
    const filter = { isActive: true };
    
    if (brand) filter.brand = { $in: brand.split(',') };
    if (category) filter.category = { $in: category.split(',') };
    if (color) filter.variants = { $elemMatch: { 'options.Color': { $in: color.split(',') } } };

    if (search) filter.name = new RegExp(search, 'i');
    if (vendor) filter.vendor = vendor;
    if (minPrice || maxPrice) {
      filter.basePrice = {};
      if (minPrice) filter.basePrice.$gte = Number(minPrice);
      if (maxPrice) filter.basePrice.$lte = Number(maxPrice);
    }
    console.log('Fetching products with filter:', filter);
    const products = await Product.find(filter)
      .populate({ path: 'vendor', select: 'name' })
      .limit(50)
      .sort({ createdAt: -1 });
    console.log('Found products:', products.length);
    res.json(products);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/products/brands
// @desc    Get a unique list of all brands
// @access  Public
router.get('/brands', async (req, res, next) => {
  try {
    const brands = await Product.find({ isActive: true }).distinct('brand');
    res.json(brands);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/products/categories
// @desc    Get a unique list of all categories
// @access  Public
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await Product.find({ isActive: true }).distinct('category');
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/products/colors
// @desc    Get a unique list of all colors
// @access  Public
router.get('/colors', async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true }).select('options');
    const colorSet = new Set();
    products.forEach(p => {
      const colorOption = p.options.find(opt => opt.name === 'Color');
      if (colorOption) {
        colorOption.values.forEach(color => colorSet.add(color));
      }
    });
    res.json(Array.from(colorSet));
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/products/tags
// @desc    Get a unique list of all tags
// @access  Public
router.get('/tags', async (req, res, next) => {
  try {
    const tags = await Product.find({ isActive: true }).distinct('tags');
    res.json(tags);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/products/suggestions
// @desc    Get search suggestions
// @access  Public
router.get('/suggestions', async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.json([]);
    }
    const regex = new RegExp(query, 'i');
    
    // Find matching products
    const products = await Product.find({ name: regex }).limit(5).select('name');
    const productNames = products.map(p => p.name);
    
    // Find matching categories
    const categories = await Product.distinct('category', { category: regex });
    
    // Find matching brands
    const brands = await Product.distinct('brand', { brand: regex });
    
    // Combine, remove duplicates, and limit
    const suggestions = [...new Set([...productNames, ...categories, ...brands])].slice(0, 10);
    
    res.json(suggestions);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/products/:id
// @desc    Update a product
// @access  Private (Vendor only)
router.put('/:id', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden: Only vendors can edit products' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Ensure the user updating the product is the one who created it
    if (product.vendor.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to edit this product' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json(updatedProduct);
  } catch (error) {
    if (error.name === 'ValidationError') res.status(400).json({ message: error.message });
    else next(error);
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete a product and all its associated data
// @access  Private (Vendor only)
router.delete('/:id', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden: Only vendors can delete products' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Ensure the user deleting the product is the one who created it
    if (product.vendor.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to delete this product' });
    }

    const productId = product._id;

    // 1. Delete images from the filesystem
    if (product.images && product.images.length > 0) {
      product.images.forEach(imageUrl => {
        // url is like '/uploads/image-123.jpg', we need the relative path from the project root
        const imagePath = path.join(__dirname, '..', 'public', imageUrl);
        fs.unlink(imagePath, (err) => {
          if (err) {
            // Log the error but don't block the process. The file might already be gone.
            console.error(`Failed to delete image: ${imagePath}`, err);
          }
        });
      });
    }

    // 2. Delete from all carts
    await Cart.updateMany({}, { $pull: { items: { product: productId } } });

    // 3. Delete from all wishlists
    await WishlistItem.deleteMany({ product: productId });
    
    // 4. Delete all likes for this product
    await Like.deleteMany({ product: productId });

    // 5. Finally, delete the product itself
    await Product.findByIdAndDelete(req.params.id);

    res.json({ message: 'Product and all associated data have been removed' });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/products/:id
// @desc    Get a single product by ID
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('vendor', 'name');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    next(error);
  }
});

module.exports = router;