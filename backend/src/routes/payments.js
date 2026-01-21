const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// @route   GET /api/payments/methods
// @desc    Get user's saved payment methods
// @access  Private
router.get('/methods', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.paymentMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', error.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/payments/methods
// @desc    Add a new payment method
// @access  Private
router.post('/methods', protect, async (req, res) => {
  try {
    const { type, last4, brand } = req.body;
    if (!type || !last4 || !brand) {
      return res.status(400).json({ message: 'Please provide type, last4, and brand' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newPaymentMethod = { type, last4, brand };
    user.paymentMethods.push(newPaymentMethod);

    if (user.paymentMethods.length === 1) {
      user.paymentMethods[0].isDefault = true;
    }

    await user.save();
    res.status(201).json(user.paymentMethods);
  } catch (error) {
    console.error('Error adding payment method:', error.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/payments/methods
// @desc    Update payment methods
// @access  Private
router.put('/methods', protect, async (req, res) => {
  try {
    const { paymentMethods } = req.body;
    if (!paymentMethods) {
      return res.status(400).json({ message: 'Please provide paymentMethods' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.paymentMethods = paymentMethods;

    await user.save();
    res.json(user.paymentMethods);
  } catch (error) {
    console.error('Error updating payment methods:', error.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/payments/methods/:id
// @desc    Delete a payment method
// @access  Private
router.delete('/methods/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const methodIndex = user.paymentMethods.findIndex(pm => pm._id.toString() === req.params.id);
    if (methodIndex === -1) {
      return res.status(404).json({ message: 'Payment method not found' });
    }

    user.paymentMethods.splice(methodIndex, 1);

    await user.save();
    res.json(user.paymentMethods);
  } catch (error) {
    console.error('Error deleting payment method:', error.message);
    res.status(500).send('Server Error');
  }
});

// POST /api/payments/create-intent (mock)
router.post('/create-intent', async (req, res, next) => {
  try {
    const { amount } = req.body;
    const order = {
      id: `order_${Date.now()}`,
      amount,
      currency: 'INR',
      status: 'created',
    };
    res.json(order);
  } catch (error) { next(error); }
});

// POST /api/payments/verify (signature verify mock)
router.post('/verify', async (req, res, next) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET || 'secret';
    const generated = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    res.json({ verified: generated === signature });
  } catch (error) { next(error); }
});

module.exports = router;


