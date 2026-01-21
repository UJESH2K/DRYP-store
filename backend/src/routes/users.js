const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
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
      categories: categories || user.preferences.categories,
      colors: colors || user.preferences.colors,
      brands: brands || user.preferences.brands,
    };

    await user.save();
    res.json(user);
  } catch (error) {
    console.error('Error updating preferences:', error.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
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

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user fields from request body
    const { name, phone, avatar, addresses } = req.body;
    
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (avatar) user.avatar = avatar;
    if (addresses) user.addresses = addresses;

    await user.save();

    res.json(user);
  } catch (error) {
    console.error('Error updating profile:', error.message);
    res.status(500).send('Server Error');
  }
});


module.exports = router;
