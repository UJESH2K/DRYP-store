const express = require('express');
const { protect } = require('../middleware/auth');
const Product = require('../models/Product');
const Like = require('../models/Like');
const WishlistItem = require('../models/WishlistItem');
const router = express.Router();

// @route   GET /api/analytics/summary
// @desc    Get summary analytics for a vendor
// @access  Private (Vendor only)
router.get('/summary', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden: Only vendors can access analytics' });
    }
    const vendorId = req.user._id;

    // 1. Get all products for the vendor
    const products = await Product.find({ vendor: vendorId }).lean();
    const productIds = products.map(p => p._id);
    const totalProducts = products.length;

    // 2. Get total likes
    const totalLikes = await Like.countDocuments({ product: { $in: productIds } });

    // 3. Get total wishlist adds
    const totalWishlisted = await WishlistItem.countDocuments({ product: { $in: productIds } });

    res.json({
      totalProducts,
      totalLikes,
      totalWishlisted,
    });

  } catch (error) {
    next(error);
  }
});

// @route   GET /api/analytics/products
// @desc    Get product analytics for a vendor
// @access  Private (Vendor only)
router.get('/products', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden: Only vendors can access analytics' });
    }

    const vendorId = req.user._id;

    // 1. Get all products for the vendor
    const products = await Product.find({ vendor: vendorId }).lean();
    if (!products.length) {
      return res.json({
        mostLiked: [],
        mostDisliked: [],
        mostWishlisted: [],
      });
    }
    const productIds = products.map(p => p._id);

    // 2. Get likes and dislikes for those products
    const likes = await Like.aggregate([
      { $match: { product: { $in: productIds } } },
      { $group: { _id: '$product', count: { $sum: 1 } } }
    ]);

    // 3. Get wishlist items for those products
    const wishlisted = await WishlistItem.aggregate([
      { $match: { product: { $in: productIds } } },
      { $group: { _id: '$product', count: { $sum: 1 } } }
    ]);
    
    // 4. Combine data
    const analytics = products.map(product => {
      const likeInfo = likes.find(l => l._id.equals(product._id));
      const wishlistedInfo = wishlisted.find(w => w._id.equals(product._id));
      
      return {
        ...product,
        likeCount: likeInfo ? likeInfo.count : 0,
        wishlistCount: wishlistedInfo ? wishlistedInfo.count : 0,
      };
    });

    // 5. Sort and return
    const mostLiked = [...analytics].sort((a, b) => b.likeCount - a.likeCount).slice(0, 10);
    const mostWishlisted = [...analytics].sort((a, b) => b.wishlistCount - a.wishlistCount).slice(0, 10);

    res.json({
      mostLiked,
      mostWishlisted,
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
