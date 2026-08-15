const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Razorpay = require('razorpay');
const Product = require('../models/Product');
let razorpayClient;
function getRazorpay() {
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
}

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
    const { orderId } = req.body;
    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found or unauthorized' });

    const rzp = getRazorpay();
    const razorpayOrder = await rzp.orders.create({
      amount: Math.round(order.totalAmount * 100),
      currency: 'INR',
      receipt: order.orderNumber,
      payment_capture: 1,
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({ id: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, key: process.env.RAZORPAY_KEY_ID });
  } catch (error) { next(error); }
});

router.post('/verify', protect, async (req, res, next) => {
  try {
    const { razorpayOrderId, paymentId, signature } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return res.status(500).json({ message: 'Razorpay not configured' });

    const generated = crypto.createHmac('sha256', secret).update(razorpayOrderId + '|' + paymentId).digest('hex');
    const isVerified = generated === signature;

    if (!isVerified) {
      await Order.findOneAndUpdate({ razorpayOrderId }, { paymentStatus: 'failed' });
      return res.status(400).json({ verified: false, message: 'Invalid payment signature' });
    }

    const order = await Order.findOneAndUpdate(
      { razorpayOrderId },
      { paymentStatus: 'completed', status: 'confirmed', razorpayPaymentId: paymentId, razorpaySignature: signature },
      { new: true }
    );

    if (order) {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
      }
    }

    res.json({ verified: true, message: 'Payment successful' });
  } catch (error) { next(error); }
});

router.get('/checkout', (req, res) => {
  const { order_id, amount, currency = 'INR', name = 'DRYP', description = 'Order Payment', email, contact } = req.query;
  const key = req.query.key || process.env.RAZORPAY_KEY_ID;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  function post(m){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(m))}
  var options = {
    key: "${esc(key)}",
    amount: ${Number(amount) || 0},
    currency: "${esc(currency)}",
    order_id: "${esc(order_id)}",
    name: "${esc(name)}",
    description: "${esc(description)}",
    handler: function (r) { post({ type: 'success', payment_id: r.razorpay_payment_id, order_id: r.razorpay_order_id, signature: r.razorpay_signature }); },
    modal: { ondismiss: function () { post({ type: 'dismiss' }); } },
  };
  var em="${esc(email || '')}", co="${esc(contact || '')}";
  if (em || co) options.prefill = { email: em, contact: co };
  try {
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function (r) { post({ type: 'failed', error: r.error }); });
    rzp.open();
  } catch (e) { post({ type: 'error', message: String(e) }); }
</script>
</body></html>`;
  res.set('Content-Type', 'text/html').send(html);
});

module.exports = router;


