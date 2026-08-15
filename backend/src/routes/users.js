const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Delete the authenticated user's account. Requires their password (local
// accounts) and removes their guest-linked data along with the user.
router.delete('/me', protect, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Not authorized' });

    const { password } = req.body || {};
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.authProvider === 'local') {
      if (!password || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ message: 'Incorrect password' });
      }
    }

    const Cart = require('../models/Cart');
    const WishlistItem = require('../models/WishlistItem');
    const Like = require('../models/Like');
    const Order = require('../models/Order');
    if (req.user._id) {
      await Promise.all([
        Cart.deleteMany({ user: req.user._id }),
        WishlistItem.deleteMany({ user: req.user._id }),
        Like.deleteMany({ user: req.user._id }),
        Order.deleteMany({ user: req.user._id }),
      ]);
    }

    await User.findByIdAndDelete(req.user._id);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Not authorized' });
    res.json({ user: req.user, token: req.headers.authorization?.split(' ')[1] });
  } catch (error) {
    console.error('Error fetching current user:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/preferences', protect, async (req, res) => {
  try {
    const { currency, categories, colors, brands } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.preferences = {
      ...user.preferences,
      currency: currency || user.preferences.currency,
      categories: (categories || user.preferences.categories).slice(0, 100),
      colors: (colors || user.preferences.colors).slice(0, 100),
      brands: (brands || user.preferences.brands).slice(0, 100),
    };

    await user.save();
    res.json(user);
  } catch (error) {
    console.error('Error updating preferences:', error.message);
    res.status(500).send('Server Error');
  }
});

router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error.message);
    res.status(500).send('Server Error');
  }
});

router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user fields from request body
    const { name, phone, avatar, addresses } = req.body;
    
    if (typeof name === 'string' && name.trim()) {
      if (name.trim().length > 100) return res.status(400).json({ message: 'Name must be 100 characters or fewer.' });
      user.name = name.trim();
    }
    if (typeof phone === 'string' && phone.trim()) {
      if (phone.trim().length > 20) return res.status(400).json({ message: 'Phone must be 20 characters or fewer.' });
      user.phone = phone.trim();
    }
    if (typeof avatar === 'string' && avatar.trim()) {
      if (avatar.trim().length > 2000) return res.status(400).json({ message: 'Avatar URL too long.' });
      user.avatar = avatar.trim();
    }
    if (addresses) {
      if (!Array.isArray(addresses) || addresses.length > 50) {
        return res.status(400).json({ message: 'Address list must be an array of at most 50 entries.' });
      }
      user.addresses = addresses;
    }

    await user.save();

    res.json(user);
  } catch (error) {
    console.error('Error updating profile:', error.message);
    res.status(500).send('Server Error');
  }
});


module.exports = router;