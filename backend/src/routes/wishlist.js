const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { identifyUser } = require('../middleware/auth');
const WishlistItem = require('../models/WishlistItem');
const Product = require('../models/Product');
const { signProductImages } = require('../utils/imageUrls');

router.get('/', identifyUser, async (req, res, next) => {
  try {
    const query = req.user ? { user: req.user._id } : { guestId: req.guestId };
    if (!req.user && !req.guestId) {
      return res.json([]);
    }
    const wishlistItems = await WishlistItem.find(query).populate('product');
    // signProductImages is async — awaiting the batch is required or res.json
    // serializes the promises as empty objects.
    const signed = (await Promise.all(
      wishlistItems.map(item => signProductImages(item.product)),
    )).filter(p => p && p.isActive !== false);
    res.json(signed);
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
    const result = await WishlistItem.findOneAndUpdate(
      query,
      { $setOnInsert: { ...query } },
      { upsert: true, new: true, includeResultMetadata: true },
    );
    if (result.lastErrorObject && result.lastErrorObject.updatedExisting) {
      return res.status(200).json({ success: true, message: 'Product already in wishlist.' });
    }

    res.status(201).json({ success: true, message: `Successfully added ${productId} to wishlist.` });
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
    await WishlistItem.findOneAndDelete(query);
    
    res.json({ success: true, message: `Successfully removed ${productId} from wishlist.` });
  } catch (error) { 
    next(error); 
  }
});

module.exports = router;

