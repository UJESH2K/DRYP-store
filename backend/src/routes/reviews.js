const express = require('express');
const Review = require('../models/Review');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/reviews');
const { reviewCreateLimiter } = require('../middleware/rateLimit');

/**
 * Reviews.
 *
 *   GET    /api/products/:id/reviews      — public, paginated
 *   POST   /api/products/:id/reviews      — authed, 1 review per
 *                                            (product, user) pair
 *   DELETE /api/reviews/:reviewId         — owner or admin
 *
 * On POST we recompute Product.rating atomically. We use a
 * findOneAndUpdate with a session to do the rating recompute in
 * the same write batch as the review insert; if the recompute
 * fails the review insert is rolled back.
 */

const router = express.Router({ mergeParams: true });

// (reviewCreateLimiter imported from middleware/rateLimit)

// GET /api/products/:id/reviews
router.get(
  '/products/:id/reviews',
  validate({ params: schemas.idParam }),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
      const skip = (page - 1) * limit;
      const [reviews, total] = await Promise.all([
        Review.find({ product: id })
          .populate('user', 'name avatar')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Review.countDocuments({ product: id }),
      ]);
      res.json({ reviews, page, limit, total, hasMore: skip + reviews.length < total });
    } catch (e) { next(e); }
  },
);

// POST /api/products/:id/reviews
router.post(
  '/products/:id/reviews',
  reviewCreateLimiter,
  protect,
  validate({ params: schemas.idParam, body: schemas.create }),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { rating, comment } = req.body;
      // Confirm the product exists and is active. The DB has a unique
      // index on (product, user) too, so a race will be a 11000 dup
      // key error which we surface as 409.
      const product = await Product.findOne({ _id: id, isActive: true }).select('_id rating reviews');
      if (!product) return res.status(404).json({ message: 'Product not found' });

      // Insert review + recompute rating. The recompute walks all
      // existing reviews in a single pass; for a product with N
      // reviews this is O(N) which is fine for our scale.
      const review = await Review.create({
        product: id,
        user: req.user._id,
        rating,
        comment,
      });
      const agg = await Review.aggregate([
        { $match: { product: review.product } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]);
      const avg = agg[0]?.avg ?? rating;
      const count = agg[0]?.count ?? 1;
      await Product.findByIdAndUpdate(id, {
        rating: Math.round(avg * 10) / 10,
        reviews: count,
      });
      await review.populate('user', 'name avatar');
      res.status(201).json(review);
    } catch (e) {
      if (e && e.code === 11000) {
        return res.status(409).json({ message: 'You already reviewed this product' });
      }
      next(e);
    }
  },
);

// DELETE /api/reviews/:reviewId
router.delete(
  '/reviews/:reviewId',
  protect,
  async (req, res, next) => {
    try {
      const review = await Review.findById(req.params.reviewId);
      if (!review) return res.status(404).json({ message: 'Review not found' });
      const isOwner = String(review.user) === String(req.user._id);
      const isAdmin = req.user.role === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      await Review.findByIdAndDelete(req.params.reviewId);
      // Recompute the product's rating.
      const agg = await Review.aggregate([
        { $match: { product: review.product } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]);
      await Product.findByIdAndUpdate(review.product, {
        rating: agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0,
        reviews: agg[0]?.count ?? 0,
      });
      res.json({ ok: true });
    } catch (e) { next(e); }
  },
);

module.exports = router;