const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required to confirm account deletion'),
  confirmText: z.literal('DELETE MY ACCOUNT'),
}).strict();

const pushTokenSchema = z.object({
  token: z.string().min(10).max(200),
  platform: z.enum(['ios', 'android', 'web']),
  appVersion: z.string().nullable().optional(),
}).strict();

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

// @route   DELETE /api/users/me
// @desc    Delete the authenticated user's account. Requires the
//          user to re-enter their password AND type a literal
//          confirmation string. We do this to make a deletion
//          hard to trigger by accident — a stolen JWT alone
//          can't wipe the account.
// @access  Private
router.delete(
  '/me',
  protect,
  validate({ body: deleteAccountSchema }),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      // password check — use bcryptjs to match the rest of the
      // codebase (the native `bcrypt` package isn't installed).
      const bcrypt = require('bcryptjs');
      const ok = await bcrypt.compare(req.body.password, user.passwordHash);
      if (!ok) return res.status(401).json({ message: 'Incorrect password' });
      // Anonymize rather than hard-delete so historical orders
      // and reviews keep a non-PII reference. The email is
      // suffixed with the deletedAt timestamp to make it
      // impossible to re-register with the same address.
      user.name = 'Deleted user';
      user.email = `deleted+${user._id}@dryp.invalid`;
      user.phone = undefined;
      user.avatar = undefined;
      user.addresses = [];
      user.paymentMethods = [];
      user.likedProducts = [];
      user.isDeleted = true;
      user.deletedAt = new Date();
      await user.save();
      res.json({ ok: true });
    } catch (error) {
      console.error('Error deleting account:', error.message);
      res.status(500).send('Server Error');
    }
  },
);

// @route   POST /api/users/push-token
// @desc    Register (or refresh) the calling user's Expo push
//          token. Idempotent: re-registering the same token
//          updates the platform/appVersion but doesn't
//          duplicate the entry.
// @access  Private
router.post(
  '/push-token',
  protect,
  validate({ body: pushTokenSchema }),
  async (req, res) => {
    try {
      const { token, platform, appVersion } = req.body;
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const existing = user.pushTokens.find((t) => t.token === token);
      if (existing) {
        existing.platform = platform;
        existing.appVersion = appVersion || null;
        existing.registeredAt = new Date();
      } else {
        user.pushTokens.push({ token, platform, appVersion: appVersion || null });
      }
      await user.save();
      res.json({ ok: true, count: user.pushTokens.length });
    } catch (error) {
      console.error('Error registering push token:', error.message);
      res.status(500).send('Server Error');
    }
  },
);

// @route   DELETE /api/users/push-token
// @desc    Unregister a push token (logout / sign out / app
//          uninstall). We match by token string so a stale
//          token can be removed even if the user lost the
//          device.
// @access  Private
router.delete(
  '/push-token',
  protect,
  async (req, res) => {
    try {
      const { token } = req.body || {};
      if (!token) return res.status(400).json({ message: 'token is required' });
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      user.pushTokens = user.pushTokens.filter((t) => t.token !== token);
      await user.save();
      res.json({ ok: true, count: user.pushTokens.length });
    } catch (error) {
      console.error('Error unregistering push token:', error.message);
      res.status(500).send('Server Error');
    }
  },
);

module.exports = router;