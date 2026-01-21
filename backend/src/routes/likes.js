const express = require('express');
const Like = require('../models/Like');
const Product = require('../models/Product');
const { identifyUser } = require('../middleware/auth'); // Use identifyUser
const mongoose = require('mongoose');
const router = express.Router();

// @route   GET /api/likes
// @desc    Get all products liked by the current user or guest
// @access  Public / Private
router.get('/', identifyUser, async (req, res, next) => {
  try {
    const query = req.user ? { user: req.user._id } : { guestId: req.guestId };
    if (!req.user && !req.guestId) {
      return res.json([]); // No user or guest, return empty array
    }
    const likes = await Like.find(query).populate('product');
    res.json(likes.map(l => l.product));
  } catch (error) { 
    next(error); 
  }
});

// @route   POST /api/likes/:productId
// @desc    Like a product
// @access  Public / Private
router.post('/:productId', identifyUser, async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestId = req.guestId;

    if (!userId && !guestId) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: `Invalid product ID: ${productId}` });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const query = userId ? { user: userId, product: productId } : { guestId, product: productId };
    const existingLike = await Like.findOne(query);
    if (existingLike) {
      return res.status(200).json({ success: true, message: 'Product already liked.' });
    }

    await Like.create({ ...query, user: userId }); // user can be null
    await Product.findByIdAndUpdate(productId, { $inc: { likes: 1 } });
    
    res.status(201).json({ success: true, message: `Successfully liked ${productId}` });
  } catch (error) { 
    next(error); 
  }
});

// @route   DELETE /api/likes/:productId
// @desc    Unlike a product
// @access  Public / Private
router.delete('/:productId', identifyUser, async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestId = req.guestId;

    if (!userId && !guestId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: `Invalid product ID: ${productId}` });
    }

    const query = userId ? { user: userId, product: productId } : { guestId, product: productId };
    const like = await Like.findOneAndDelete(query);

    if (like) {
      await Product.findByIdAndUpdate(productId, { $inc: { likes: -1 } });
    }
    
    res.json({ success: true, message: `Successfully unliked ${productId}` });
  } catch (error) { 
    next(error); 
  }
});

module.exports = router;