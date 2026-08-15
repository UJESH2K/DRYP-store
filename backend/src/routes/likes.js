const express = require('express');
const Like = require('../models/Like');
const Product = require('../models/Product');
const { identifyUser } = require('../middleware/auth'); // Use identifyUser
const mongoose = require('mongoose');
const router = express.Router();

router.get('/', identifyUser, async (req, res, next) => {
  try {
    const query = req.user ? { user: req.user._id } : { guestId: req.guestId };
    if (!req.user && !req.guestId) {
      return res.json([]); // No user or guest, return empty array
    }
    const likes = await Like.find(query).populate('product');
    // Drop hard-deleted (null) and deactivated products; archived products
    // get their Like rows cleaned at archive time, this guards the rest.
    res.json(likes.map(l => l.product).filter(p => p && p.isActive !== false));
  } catch (error) { 
    next(error); 
  }
});

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

    const product = await Product.findOne({ _id: productId, isActive: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const query = userId ? { user: userId, product: productId } : { guestId, product: productId };
    const existingLike = await Like.findOne(query);
    if (existingLike) {
      return res.status(200).json({ success: true, message: 'Product already liked.' });
    }

    await Like.create(query);
    await Product.findByIdAndUpdate(productId, { $inc: { likes: 1 } });
    
    res.status(201).json({ success: true, message: `Successfully liked ${productId}` });
  } catch (error) { 
    next(error); 
  }
});

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