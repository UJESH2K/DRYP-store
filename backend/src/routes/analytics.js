const express = require('express');
const { requireVendor, requireAdmin } = require('../middleware/requireRole');
const Product = require('../models/Product');
const Like = require('../models/Like');
const WishlistItem = require('../models/WishlistItem');
const User = require('../models/User');
const Order = require('../models/Order');
const Vendor = require('../models/Vendor');
const router = express.Router();

// @route   GET /api/analytics/summary
// @desc    Get summary analytics for a vendor
// @access  Private (Vendor only)
router.get('/summary', requireVendor, async (req, res, next) => {
  try {
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
router.get('/products', requireVendor, async (req, res, next) => {
  try {
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

// @route   GET /api/analytics/admin/metrics
// @desc    Platform-wide metrics for the admin console.
//          Returns counts, recent signups, top vendors, and
//          a revenue-by-day series for the last 30 days.
// @access  Private (Admin only)
//
// All counts are run in parallel — they're independent
// aggregations against different collections.
router.get('/admin/metrics', requireAdmin, async (req, res, next) => {
  try {
    const [
      userCount,
      vendorCount,
      productCount,
      orderCount,
      revenueAgg,
      recentSignups,
      topVendors,
      ordersByStatus,
    ] = await Promise.all([
      User.countDocuments({ isDeleted: { $ne: true } }),
      Vendor.countDocuments({}),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments({}),
      // Revenue: sum of `total` for non-cancelled orders.
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      // Last 7 days of signups.
      User.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      // Top 5 vendors by completed-order count.
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.vendor', revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }, orders: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        // Order.items.vendor is a User id; the Vendor doc lives in
        // the `vendors` collection and joins via Vendor.owner.
        { $lookup: { from: 'vendors', localField: '_id', foreignField: 'owner', as: 'vendor' } },
        { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            vendorUserId: '$_id',
            vendorName: '$vendor.name',
            revenue: 1,
            orders: 1,
          },
        },
      ]),
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    // Build a 30-day revenue series. We back-fill missing days
    // with 0 so the chart is continuous.
    const daily = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const dayMap = new Map(daily.map((d) => [d._id, d]));
    const revenue30d = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const row = dayMap.get(key);
      revenue30d.push({
        date: key,
        revenue: row?.revenue || 0,
        orders: row?.orders || 0,
      });
    }

    res.json({
      counts: {
        users: userCount,
        vendors: vendorCount,
        products: productCount,
        orders: orderCount,
        revenue: revenueAgg[0]?.total || 0,
      },
      signupsByDay: recentSignups,
      revenueByDay: revenue30d,
      topVendors,
      ordersByStatus: ordersByStatus.reduce((acc, x) => { acc[x._id] = x.count; return acc; }, {}),
    });
  } catch (error) { next(error); }
});

module.exports = router;
