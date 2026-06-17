const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const WishlistItem = require('../models/WishlistItem');
const Like = require('../models/Like');
const { requireVendor } = require('../middleware/requireRole');
const { parseAndValidate } = require('../utils/excelImport');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/products');
const router = express.Router();

// Phase 3A: in-memory upload for Excel import. 5MB cap, xlsx/xls/csv only.
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only .xlsx, .xls, .csv allowed'), ok);
  },
});

// @route   POST /api/products
// @desc    Create a new product
// @access  Private (Vendor only)
router.post('/', requireVendor, async (req, res, next) => {
  try {
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

// @route   POST /api/products/import
// @desc    Bulk-import products from an Excel/CSV file (Phase 3A).
//          Vendor-only. Always returns 200 with per-row results so the
//          client can render "imported N, failed M" without a 4xx.
// @access  Private (Vendor only)
//   form-data: file=<binary>, dryRun=true|false
router.post('/import', requireVendor, importUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Use form-data "file".' });
    }
    const dryRun = String(req.body.dryRun || 'false').toLowerCase() === 'true';
    const result = await parseAndValidate(req.file.buffer, req.user._id, { dryRun });
    const okCount = result.rows.filter((r) => r.ok).length;
    res.json({
      total: result.rows.length,
      imported: okCount,
      failed: result.errors.length,
      dryRun,
      rows: result.rows,
    });
  } catch (e) {
    next(e);
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
router.put('/:id', requireVendor, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Ensure the user updating the product is the one who created it
    if (product.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this product' });
    }

    const { name, description, brand, category, tags, basePrice, options, variants, images } = req.body;
    const safeUpdateData = {
        name, description, brand, category, tags, basePrice, options, variants, images
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      { $set: safeUpdateData }, 
      { new: true, runValidators: true }
    );

    res.json(updatedProduct);
  } catch (error) {
    if (error.name === 'ValidationError') res.status(400).json({ message: error.message });
    else next(error);
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete a product and all its associated data
// @access  Private (Vendor only)
router.delete('/:id', requireVendor, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }

    product.isActive = false;
    await product.save();

    const productId = product._id;

    await Cart.updateMany({}, { $pull: { items: { product: productId } } });
    await WishlistItem.deleteMany({ product: productId });
    await Like.deleteMany({ product: productId });

    res.json({ message: 'Product archived successfully' });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/products/trending
// @desc    Trending products — most-liked in the last 7 days.
//          Falls back to highest-rated if there aren't enough
//          recent likes. Returns up to 20.
// @access  Public
//
// IMPORTANT: this route MUST be declared before `/:id` so
// Express's first-match-wins routing doesn't interpret
// "trending" as a product id.
router.get('/trending', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const windowMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const since = new Date(Date.now() - windowMs);

    const Like = require('../models/Like');
    const recent = await Like.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$product', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    let products;
    if (recent.length >= 2) {
      const ids = recent.map((r) => r._id);
      products = await Product.find({ _id: { $in: ids }, isActive: true })
        .select('name brand basePrice images rating category');
      // Preserve the trending order from the aggregation.
      const order = new Map(ids.map((id, i) => [String(id), i]));
      products.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));
    } else {
      // Not enough recent signal — fall back to highest-rated
      // products, weighted by review count.
      products = await Product.find({ isActive: true })
        .select('name brand basePrice images rating reviews category')
        .sort({ rating: -1, reviews: -1 })
        .limit(limit);
    }
    res.json(products);
  } catch (error) { next(error); }
});

// @route   GET /api/products/:id
// @desc    Get a single product by ID
// @access  Public
router.get('/:id', validate({ params: schemas.idParam }), async (req, res, next) => {
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