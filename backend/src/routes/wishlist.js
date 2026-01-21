const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { identifyUser } = require('../middleware/auth');
const WishlistItem = require('../models/WishlistItem');
const Product = require('../models/Product');

// @route   GET /api/wishlist
// @desc    Get all products in the current user's or guest's wishlist
// @access  Public / Private
router.get('/', identifyUser, async (req, res, next) => {
  try {
    const query = req.user ? { user: req.user._id } : { guestId: req.guestId };
    if (!req.user && !req.guestId) {
      return res.json([]);
    }
    const wishlistItems = await WishlistItem.find(query).populate('product');
    res.json(wishlistItems.map(item => item.product));
  } catch (error) { 
    next(error); 
  }
});

// @route   POST /api/wishlist/:productId
// @desc    Add a product to the user's or guest's wishlist
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
    const existingItem = await WishlistItem.findOne(query);
    if (existingItem) {
      return res.status(200).json({ success: true, message: 'Product already in wishlist.' });
    }

    await WishlistItem.create({ ...query, user: userId });
    
    res.status(201).json({ success: true, message: `Successfully added ${productId} to wishlist.` });
  } catch (error) { 
    next(error); 
  }
});

// @route   DELETE /api/wishlist/:productId
// @desc    Remove a product from the user's or guest's wishlist
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
    await WishlistItem.findOneAndDelete(query);
    
    res.json({ success: true, message: `Successfully removed ${productId} from wishlist.` });
  } catch (error) { 
    next(error); 
  }
});

module.exports = router;

