const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/auth');
const Product = require('../../models/Product');
const WishlistItem = require('../../models/WishlistItem');
const Order = require('../../models/Order');

// @route   GET /api/analytics/vendor
// @desc    Get dashboard analytics for the logged-in vendor
// @access  Private (Vendor only)
router.get('/vendor', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const vendorId = req.user._id;

    // --- Aggregate Metrics ---
    const productStats = await Product.aggregate([
      { $match: { vendor: vendorId } },
      {
        $group: {
          _id: null,
          totalLikes: { $sum: '$likes' },
          totalProducts: { $sum: 1 },
        },
      },
    ]);

    const wishlistedCount = await WishlistItem.countDocuments({
      product: { $in: await Product.find({ vendor: vendorId }).distinct('_id') }
    });

    const orderStats = await Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.vendor': vendorId } },
      {
        $group: {
          _id: null,
          totalOrders: { $addToSet: '$orderNumber' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      {
        $project: {
          _id: 0,
          totalOrders: { $size: '$totalOrders' },
          totalRevenue: 1,
        }
      }
    ]);
    
    // --- Top Products ---
    const topLikedProducts = await Product.find({ vendor: vendorId })
      .sort({ likes: -1 })
      .limit(5)
      .select('name likes');

    const topSoldProducts = await Order.aggregate([
        { $unwind: '$items' },
        { $match: { 'items.vendor': vendorId } },
        { $group: { _id: '$items.product', totalQuantity: { $sum: '$items.quantity' } } },
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'productDetails' } },
        { $unwind: '$productDetails' },
        { $project: { name: '$productDetails.name', totalQuantity: 1 } }
    ]);


    res.json({
      summary: {
        totalProducts: productStats[0]?.totalProducts || 0,
        totalLikes: productStats[0]?.totalLikes || 0,
        totalWishlisted: wishlistedCount || 0,
        totalOrders: orderStats[0]?.totalOrders || 0,
        totalRevenue: orderStats[0]?.totalRevenue || 0,
      },
      topLikedProducts,
      topSoldProducts
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
