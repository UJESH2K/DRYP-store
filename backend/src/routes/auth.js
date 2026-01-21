const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Like = require('../models/Like');
const WishlistItem = require('../models/WishlistItem');
const Order = require('../models/Order');
const router = express.Router();

const mergeGuestData = async (userId, guestId) => {
  if (!guestId) return;
  try {
    // Merge likes, avoiding duplicates
    const guestLikes = await Like.find({ guestId });
    const userLikes = await Like.find({ user: userId });
    const userLikedProductIds = new Set(userLikes.map(l => l.product.toString()));

    for (const like of guestLikes) {
      if (!userLikedProductIds.has(like.product.toString())) {
        like.user = userId;
        like.guestId = null;
        await like.save();
      } else {
        await Like.findByIdAndDelete(like._id);
      }
    }
    
    // Merge wishlist, avoiding duplicates
    const guestWishlistItems = await WishlistItem.find({ guestId });
    const userWishlistItems = await WishlistItem.find({ user: userId });
    const userWishlistProductIds = new Set(userWishlistItems.map(i => i.product.toString()));

    for (const item of guestWishlistItems) {
      if (!userWishlistProductIds.has(item.product.toString())) {
        item.user = userId;
        item.guestId = null;
        await item.save();
      } else {
        await WishlistItem.findByIdAndDelete(item._id);
      }
    }
    
    // Merge orders (cart)
    await Order.updateMany({ guestId, status: 'cart' }, { user: userId, guestId: null });

  } catch (error) {
    console.error(`Error merging guest data for user ${userId} from guest ${guestId}:`, error);
  }
};


// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, guestId } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });
    
    await mergeGuestData(user._id, guestId);

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

    res.json({ token, user });
  } catch (error) { next(error); }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, guestId } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
    
    await mergeGuestData(user._id, guestId);
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    
    res.json({ token, user });
  } catch (error) { next(error); }
});

module.exports = router;


