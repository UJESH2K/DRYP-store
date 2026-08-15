const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Cart = require('../models/Cart'); 
const WishlistItem = require('../models/WishlistItem'); 
const Like = require('../models/Like'); 
const { protect } = require('../middleware/auth');
const { signProductImages, normalizeImageKeys } = require('../utils/imageUrls');
const { generateProductEmbedding } = require('../utils/embeddings');
const router = express.Router();

router.post('/', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden: Only vendors can create products' });
    }
    const productData = {
      ...req.body,
      vendor: req.user._id,
      images: normalizeImageKeys(req.body.images),
      variants: Array.isArray(req.body.variants)
        ? req.body.variants.map((variant) => ({
            ...variant,
            images: normalizeImageKeys(variant.images),
          }))
        : req.body.variants,
    };
    const product = await Product.create(productData);
    generateProductEmbedding(product).then(embedding => {
      Product.updateOne({ _id: product._id }, { $set: { embedding } }).catch(() => {});
    }).catch(() => {});
    res.status(201).json(await signProductImages(product));
  } catch (error) {
    if (error.name === 'ValidationError') res.status(400).json({ message: error.message });
    else next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { brand, category, color, search, vendor, minPrice, maxPrice, source, sortBy, limit, exclude } = req.query;
    const filter = { isActive: true };

    if (brand) filter.brand = { $in: brand.split(',') };
    if (category) filter.category = { $in: category.split(',') };
    if (color) filter.variants = { $elemMatch: { 'options.Color': { $in: color.split(',') } } };

    if (search) filter.name = new RegExp(search, 'i');
    if (vendor) filter.vendor = vendor;
    if (source) filter.source = source;
    if (minPrice || maxPrice) {
      filter.basePrice = {};
      if (minPrice) filter.basePrice.$gte = Number(minPrice);
      if (maxPrice) filter.basePrice.$lte = Number(maxPrice);
    }
    if (exclude) {
      const excludeIds = exclude.split(',')
        .map(id => id.trim())
        .filter(id => mongoose.Types.ObjectId.isValid(id));
      if (excludeIds.length > 0) {
        filter._id = { $nin: excludeIds };
      }
    }

    // Sort whitelist — cursor pagination is only valid on the default createdAt sort.
    const sortWhitelist = {
      createdAt: { createdAt: -1, _id: -1 },
      basePrice: { basePrice: -1 },
      rating: { rating: -1 },
      likes: { likes: -1 },
    };
    let sort = sortWhitelist.createdAt;
    if (sortBy) {
      const [key, dir] = sortBy.split(':');
      const baseSort = sortWhitelist[key];
      if (baseSort) {
        const direction = dir === 'asc' ? 1 : -1;
        sort = Object.fromEntries(Object.entries(baseSort).map(([k]) => [k, direction]));
      }
    }
    const parsedLimit = Number(limit);
    const finalLimit = Number.isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100);

    const products = await Product.find(filter)
      .populate({ path: 'vendor', select: 'name' })
      .limit(finalLimit)
      .sort(sort);
    res.json(await Promise.all(products.map((product) => signProductImages(product))));
  } catch (error) {
    next(error);
  }
});

router.get('/brands', async (req, res, next) => {
  try {
    const brands = await Product.find({ isActive: true }).distinct('brand');
    res.json(brands);
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await Product.find({ isActive: true }).distinct('category');
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

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

router.get('/tags', async (req, res, next) => {
  try {
    const tags = await Product.find({ isActive: true }).distinct('tags');
    res.json(tags);
  } catch (error) {
    next(error);
  }
});

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

router.put('/:id', protect, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Product not found' });
    }
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

    const { name, description, brand, category, tags, basePrice, options, variants, images, isActive } = req.body;
    const safeUpdateData = {
        name,
        description,
        brand,
        category,
        tags,
        basePrice,
        options,
        variants: Array.isArray(variants)
          ? variants.map((variant) => ({
              ...variant,
              images: normalizeImageKeys(variant.images),
            }))
          : variants,
        images: normalizeImageKeys(images),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      { $set: safeUpdateData }, 
      { new: true, runValidators: true }
    );

    // Deactivating via the edit screen must have the same integrity effect as
    // archiving: drop the product from carts, wishlists and likes so inactive
    // products stop appearing in user flows (orders already reject them).
    if (updatedProduct && updatedProduct.isActive === false) {
      const productId = updatedProduct._id;
      await Cart.updateMany({}, { $pull: { items: { product: productId } } });
      await WishlistItem.deleteMany({ product: productId });
      await Like.deleteMany({ product: productId });
    }

    generateProductEmbedding(updatedProduct).then(embedding => {
      Product.updateOne({ _id: updatedProduct._id }, { $set: { embedding } }).catch(() => {});
    }).catch(() => {});

    res.json(await signProductImages(updatedProduct));
  } catch (error) {
    if (error.name === 'ValidationError') res.status(400).json({ message: error.message });
    else next(error);
  }
});

router.delete('/:id', protect, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden: Only vendors can delete products' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.vendor.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to delete this product' });
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

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const product = await Product.findOne({ _id: req.params.id, isActive: true }).populate('vendor', 'name');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(await signProductImages(product));
  } catch (error) {
    next(error);
  }
});

const { scrapeShopifyProduct } = require('../utils/shopifyScraper');

router.post('/shopify-scrape', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden: Only vendors can create products' });
    }

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ message: 'Product URL is required' });
    }

    const scrapedData = await scrapeShopifyProduct(url);

    const productData = {
      name: scrapedData.name,
      description: scrapedData.description,
      brand: scrapedData.brand || req.user.name || 'Unknown Brand',
      category: scrapedData.category || 'Uncategorized',
      basePrice: scrapedData.basePrice,
      images: normalizeImageKeys(scrapedData.images),
      tags: scrapedData.tags,
      source: 'shopify',
      externalId: scrapedData.externalId || url,
      vendor: req.user._id,
      variants: scrapedData.variants.map(v => ({
        ...v,
        images: normalizeImageKeys(v.images),
      })),
    };

    const product = await Product.create(productData);

    generateProductEmbedding(product).then(embedding => {
      Product.updateOne({ _id: product._id }, { $set: { embedding } }).catch(() => {});
    }).catch(() => {});

    res.status(201).json(await signProductImages(product));
  } catch (error) {
    console.error('Shopify scrape error:', error);
    if (error.message.includes('Failed to fetch URL')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to scrape product. Check the URL and try again.' });
  }
});

router.post('/shopify-preview', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ message: 'Product URL is required' });
    }

    const scrapedData = await scrapeShopifyProduct(url);
    res.json(scrapedData);
  } catch (error) {
    console.error('Shopify preview error:', error);
    if (error.message.includes('Failed to fetch URL')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to scrape product.' });
  }
});

module.exports = router;
