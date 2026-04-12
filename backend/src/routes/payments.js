const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');

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

// @route   PUT /api/payments/methods/:id/default
// @desc    Set a payment method as default
// @access  Private
router.put('/methods/:id/default', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Loop through all methods and set only the matching ID to true
    user.paymentMethods.forEach(pm => {
      pm.isDefault = pm._id.toString() === req.params.id;
    });

    await user.save();
    res.json(user.paymentMethods);
  } catch (error) {
    console.error('Error setting default payment method:', error.message);
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

router.post('/create-intent', protect, async (req, res, next) => {
  try {
    const { orderId, amount } = req.body; 

    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) {
        return res.status(404).json({ message: 'Order not found or unauthorized' });
    }

    const razorpayOrderId = `rzp_order_${Date.now()}`;

    order.razorpayOrderId = razorpayOrderId;
    await order.save();

    res.json({
      id: razorpayOrderId,
      amount: order.totalAmount, 
      currency: 'USD',
      status: 'created',
    });
  } catch (error) { next(error); }
});

router.post('/verify', protect, async (req, res, next) => {
  try {
    const { razorpayOrderId, paymentId, signature } = req.body; 
    
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new Error('FATAL: RAZORPAY_KEY_SECRET missing in environment variables');

    const generated = crypto.createHmac('sha256', secret).update(`${razorpayOrderId}|${paymentId}`).digest('hex');
    const isVerified = generated === signature;

    if (!isVerified) {
        await Order.findOneAndUpdate({ razorpayOrderId }, { paymentStatus: 'failed' });
        return res.status(400).json({ verified: false, message: 'Invalid payment signature. Potential fraud attempt.' });
    }

    const order = await Order.findOneAndUpdate(
        { razorpayOrderId: razorpayOrderId }, 
        { 
            paymentStatus: 'completed',
            status: 'confirmed', 
            razorpayPaymentId: paymentId,
            razorpaySignature: signature
        },
        { new: true }
    );

    if (!order) {
        return res.status(404).json({ verified: true, message: 'Payment verified, but Order record missing from database.' });
    }

    res.json({ verified: true, message: 'Payment successful and order confirmed.' });
  } catch (error) { next(error); }
});

module.exports = router;


