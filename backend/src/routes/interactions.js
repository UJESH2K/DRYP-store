const express = require('express');
const router = express.Router();
const { identifyUser } = require('../middleware/auth');
const InteractionEvent = require('../models/InteractionEvent');
const Product = require('../models/Product');
const mongoose = require('mongoose');

router.post('/', identifyUser, async (req, res, next) => {
  try {
    const { action, productId, source, swipeVelocity, dwellTimeMs } = req.body;
    const userId = req.user ? req.user._id : null;
    const guestId = req.headers['x-guest-id'] || null;
    if (!userId && !guestId) return res.status(401).json({ message: 'Not authorized' });

    const valid = ['swipe_left','swipe_right','swipe_up','like','unlike','wishlist_add','wishlist_remove','cart_add','cart_remove','product_view','checkout_start','order_placed','chat_interest'];
    if (!action || !valid.includes(action)) return res.status(400).json({ message: 'Invalid action' });
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: 'Invalid product ID' });

    const product = await Product.findById(productId).select('name brand category tags basePrice');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const event = await InteractionEvent.create({
      user: userId, guestId, action, product: productId,
      productSnapshot: { name: product.name, brand: product.brand, category: product.category, tags: product.tags || [], basePrice: product.basePrice },
      source: source || 'unknown', swipeVelocity, dwellTimeMs,
    });
    res.status(201).json({ success: true, id: event._id });
  } catch (e) { next(e); }
});

module.exports = router;
