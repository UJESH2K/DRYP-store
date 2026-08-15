const express = require('express');
const router = express.Router();
const { identifyUser } = require('../middleware/auth');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const { buildUserProfile, buildTasteVector, scoreProducts } = require('../utils/feedRanking');
const { signProductImages } = require('../utils/imageUrls');

/**
 * GET /api/feed/personalized
 * Returns a personalized product feed ranked by user taste profile.
 * Query params:
 *   - limit: number (default 50, max 100)
 *   - exclude: comma-separated product IDs to exclude
 *   - brand: comma-separated brand names (same semantics as GET /api/products)
 *   - category: comma-separated categories
 *   - color: comma-separated variant colors (matches variants.options.Color)
 */
router.get('/personalized', identifyUser, async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const guestId = req.guestId;

    // Parse limit
    let limit = 50;
    if (req.query.limit !== undefined) {
      const parsed = Number(req.query.limit);
      if (!Number.isNaN(parsed)) {
        limit = Math.max(1, Math.min(100, parsed));
      }
    }

    // Parse exclude IDs
    let excludeFilter = {};
    if (req.query.exclude) {
      const ids = String(req.query.exclude)
        .split(',')
        .map(s => s.trim())
        .filter(id => mongoose.Types.ObjectId.isValid(id));
      if (ids.length > 0) {
        excludeFilter = { _id: { $nin: ids } };
      }
    }

    // Optional browse filters — same $in/$elemMatch semantics as GET /api/products
    // Accepts comma-separated strings or repeated query keys (Express parses those as arrays).
    const toValues = (v) => [].concat(v ?? [])
      .flatMap(s => String(s).split(','))
      .map(s => s.trim())
      .filter(Boolean);
    const browseFilter = {};
    const brands = toValues(req.query.brand);
    const categories = toValues(req.query.category);
    const colors = toValues(req.query.color);
    if (brands.length > 0) browseFilter.brand = { $in: brands };
    if (categories.length > 0) browseFilter.category = { $in: categories };
    if (colors.length > 0) {
      browseFilter.variants = { $elemMatch: { 'options.Color': { $in: colors } } };
    }

    // Build candidate pool (larger than limit for meaningful ranking).
    // Sort newest-first at the DB so the pool covers recent products instead
    // of an arbitrary insertion-order window — otherwise the newest ~744 of
    // the 944-product catalog would never surface on the first load.
    const candidateLimit = Math.max(200, limit * 4);
    const candidates = await Product.find({ isActive: true, ...browseFilter, ...excludeFilter })
      .sort({ createdAt: -1, _id: -1 })
      .populate({ path: 'vendor', select: 'name' })
      .limit(candidateLimit)
      .lean();

    // If no user/guest identity, return newest-first feed (no scoring)
    if (!userId && !guestId) {
      const newest = candidates
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
      const signed = await Promise.all(newest.map(p => signProductImages(p)));
      return res.json(signed);
    }

    // Build profile and taste vector
    const profile = await buildUserProfile(userId, guestId);
    // Attach userId/guestId for buildTasteVector to re-query events
    profile._userId = userId;
    profile._guestId = guestId;
    profile.tasteVector = await buildTasteVector(profile);

    // Score and rank
    const ranked = await scoreProducts(candidates, profile);
    const top = ranked.slice(0, limit);

    // Sign images and attach score
    const signed = await Promise.all(top.map(async (p) => {
      const signedProduct = await signProductImages(p);
      return { ...signedProduct, score: p.score };
    }));

    res.json(signed);
  } catch (e) {
    next(e);
  }
});

module.exports = router;